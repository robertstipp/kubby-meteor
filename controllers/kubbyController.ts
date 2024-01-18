import k8s = require('@kubernetes/client-node');
import client from 'prom-client'

const KubeNamespace = 'kube-system';
const kc = new k8s.KubeConfig();

kc.loadFromFile('./edwinscluster-config.yaml');

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

interface KubbyController {
  getClusterInfo: () => void;
  getMetrics: () => void;
}


const totalNodes = new client.Gauge({
  name: 'totalNodes',
  help: 'This is total number of nodes',
});

const totalCores = new client.Gauge({
    name: 'totalCores',
    help: 'This is total number of CPU cores',
});

const totalAllocatableCores = new client.Gauge({
    name: 'totalCPUCores',
    help: 'This is total number of allocatable CPU cores',
});

const totalMemory = new client.Gauge({
    name: 'totalMemory',
    help: 'This is total number of memory',
});

const totalAllocatableMemory = new client.Gauge({
    name: 'totalAllocatableMemory',
    help: 'This is total number of allocatable memory',
});

const kubbyController: KubbyController = {
  getClusterInfo: async () => {
    const nodeResponse = await k8sApi.listNode()
    const nodes = nodeResponse.body.items
    totalNodes.set(nodes.length)

        let cpuCores = 0;
        let allocatableCores = 0;
        let memoryBytes = 0; 
        let allocatableMemoryBytes = 0;
        nodes.forEach((node) => { 

            if (node.status?.capacity) {
                cpuCores += parseInt(node.status.capacity.cpu);
                memoryBytes += parseKubernetesMemoryString(node.status.capacity.memory);
            }

            if (node.status?.allocatable) {
                allocatableCores += parseCpuStringToCores(node.status.allocatable.cpu);
                allocatableMemoryBytes += parseKubernetesMemoryString(node.status.allocatable.memory);
            }
            
        });

        totalNodes.set(nodes.length);
        totalCores.set(cpuCores);
        totalAllocatableCores.set(allocatableCores);
        const totalMemoryRD = +convertKiBToGiB(memoryBytes).toFixed(2);
        totalMemory.set(totalMemoryRD);
        const totalAllocatableMemoryRD = +convertKiBToGiB(allocatableMemoryBytes).toFixed(2);
        totalAllocatableMemory.set(totalAllocatableMemoryRD);

        const metrics = await client.register.metrics()
        console.log(metrics)

  },
  getMetrics: async() => {

  }
}

function convertKiBToGiB(kibytes: number) {
    return kibytes / Math.pow(2,30 ); // 1048576 is 2^20
}

function parseCpuStringToCores(cpuString: string) { 
    if (cpuString.endsWith('m')) { 
        return parseInt(cpuString.slice(0, -1), 10) / 1000;
    }
    return parseInt(cpuString, 10);
}

function parseKubernetesMemoryString(memString: string) {
    const units: { [key: string]: number } = {
        Ki: 1024,
        Mi: 1024 * 1024,
        Gi: 1024 * 1024 * 1024,
      };
    const regex = /(\d+)([KMG]i)/;
    const [, num, unit] = memString.match(regex) || [];
    return num ? parseInt(num, 10) * (units[unit] || 1) : 0;
  }

export default kubbyController;