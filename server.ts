import express, {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
  response,
} from 'express';
import cors from 'cors';

import kubbyController from './controllers/kubbyController';
import promController from './controllers/promController';
import usageMetricsController from './controllers/usageMetricsController';

async function run () {

    
    const OBJECT = await kubbyController.getClusterMetrics();
    // console.log(OBJECT)
  process.exit(0)
}

const app = express();
const PORT = 8000;

// const KubeNamespace = 'kube-system';
// const kc = new k8s.KubeConfig();

// kc.loadFromDefault();
// kc.loadFromFile('./kubeConfig.yaml');

// const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

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

app.listen(PORT, () => {
  console.log(`Server listening on Port ${PORT}`);
});
