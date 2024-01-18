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

// const gauge = new client.Gauge({
//   name: 'k8s_node-count',
//   help: 'Number of pods in the cluster'
// })

const kubbyController: KubbyController = {
  getClusterInfo: async () => {
    const nodeResponse = await k8sApi.listNode()
    const numNodes = nodeResponse.body.items
    console.log(numNodes.length)
    
  },
  getMetrics: async() => {

  }
}




export default kubbyController;