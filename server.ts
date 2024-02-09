import express, {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
  response,
} from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import * as k8s from '@kubernetes/client-node';
import { kc } from './k8s-client';

import kubbyController from './controllers/kubbyController';
import promController from './controllers/promController';
import usageMetricsController from './controllers/usageMetricsController';

async function run() {
  const OBJECT = await kubbyController.getClusterMetrics();
  process.exit(0);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    // origin: ["http://localhost:3001", "http://localhost:8080"],
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const watch = new k8s.Watch(kc);

const PORT = 8000;

app.use(cors());

app.get('/', (req: Request, res: Response): void => {
  res.status(200).send('HELLO\n');
});

app.get(
  '/node-view',
  kubbyController.getNodeView,
  (req: Request, res: Response): void => {
    if (res.locals.nodeView) {
      res.status(200).json(res.locals.nodeView);
    } else {
      res.status(400).send({ message: 'Cluster information not found' });
    }
  }
);

app.get(
  '/usage-metrics',
  usageMetricsController.getUsageMetrics,
  (req: Request, res: Response): void => {
    if (res.locals.cUsageMetrics) {
      //   console.log(res.locals.cUsageMetrics);
      res.status(200).json(res.locals.cUsageMetrics);
    } else {
      res
        .status(400)
        .send({ message: 'Container usage metrics information not found' });
    }
  }
);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const defaultErr = {
    log: 'Express error handler caught unknown middleware error',
    status: 400,
    message: { err: 'An error occurred' },
  };

  const errorObj = Object.assign(defaultErr, err);
  console.log(errorObj.log);
  res.status(errorObj.status).send(errorObj.message);
});

// Websocket Build Up
io.on('connection', () => {
  console.log('Connected');
});

const namespace = 'default'; // Define your namespace

function startWatching() {
  watch
    .watch(
      `/api/v1/namespaces/${namespace}/pods`, // Watch specific namespace
      {},
      (type, apiObj, watchObj) => {
        if (type === 'ADDED') {
          console.log('New Pod Added:', apiObj.metadata.name);
          io.emit('podAdded', apiObj);
        } else if (type === 'MODIFIED') {
          console.log('Pod Modified:', apiObj.metadata.name);
          io.emit('podModified', apiObj);
        } else if (type === 'DELETED') {
          console.log('Pod Deleted:', apiObj.metadata.name);
          io.emit('podDeleted', apiObj);
        }
      },
      (err) => {
        console.error(err);
        io.emit('watchError', err);
        setTimeout(startWatching, 5000);
      }
    )
    .then((req) => {
      console.log('Watching for changes in namespace:', namespace);
    })
    .catch((err) => {
      console.error('Error starting the watch:', err);
      setTimeout(startWatching, 5000);
    });
}
startWatching();

server.listen(PORT, () => {
  console.log(`Server listening on Port ${PORT}`);
});
