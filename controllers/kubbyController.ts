import k8s = require('@kubernetes/client-node');
import client from 'prom-client'

const KubeNamespace = 'kube-system';
const kc = new k8s.KubeConfig();

kc.loadFromFile('./edwins.yaml');

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

interface KubbyController {
  getClusterInfo: () => void;
  getMetrics: () => void;
}


const countNodes = new client.Gauge({
  name: 'numNodes',
  help: 'This is number of nodes',
});


const kubbyController: KubbyController = {
  getClusterInfo: async () => {
    const nodeResponse = await k8sApi.listNode()
    const numNodes = nodeResponse.body.items
    countNodes.set(numNodes.length)
    // console.log(numNodes.length)
    const metrics = await client.register.metrics()
    console.log(metrics.toString())
    // console.log(counter.get())
    
  },
  getMetrics: async() => {

  }
}




export default kubbyController;