
import express , {Request, Response} from 'express'
import cors from 'cors';

import kubbyController from './controllers/kubbyController';

import promController from './controllers/promController';

// promController.getMetrics()

async function run () {
  await kubbyController.getClusterInfo()
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

app.get('/', (req: Request, res: Response) : void => {
  res.status(200).send("HELLO\n")
})


interface PodObj {
    name: string | undefined,
    memory : number | string,
    cpu:  number | string,
}

// app.get('/clusterInfo', async (req: Request, res: Response) : Promise <void> => {
//   try {

//     // NODES PODS CONTAINERS
//     const cluster = [];
//     const nodes = [];
//     const containers = []; 
//     const pods = [];

//     const nodeResponse =  await k8sApi.listNode();
//     for (const node of nodeResponse.body.items) {
//       const nodeObj = {
//         name: node.metadata?.name,
//         cpu: node.status?.allocatable?.cpu,
//         memory: node.status?.allocatable?.memory,
//         pods: node.status?.allocatable?.pods,
//         os: node.status?.nodeInfo?.operatingSystem
//       }
//       nodes.push(nodeObj)
//       cluster.push({...nodeObj, type: 'node'})
//     }

//     const podResponse = await k8sApi.listPodForAllNamespaces()
//     console.log(podResponse)
//     res.status(200).json(cluster)
//   } catch (error) {
//     console.log(error)
//   }
// })
// app.get('/getAllNodes', async (req: Request, res: Response) : Promise <void> => {
//   try {
//     const response = await k8sApi.listNode()
//     const nodes = response.body.items.map((node)=>node.metadata?.name)
//     console.log(response.body.items)
//     res.status(200).json(nodes)
//   } catch (error) {
//     console.log(error)
//   }
// })

// kubbyController.getClusterInfo()


app.listen(PORT, () => {
  console.log(`Server listening on Port ${PORT}`)
})

run()