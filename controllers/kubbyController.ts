import k8s = require('@kubernetes/client-node');
import { NextFunction, Response, Request } from 'express';
import client from 'prom-client'

const KubeNamespace = 'kube-system';
const kc = new k8s.KubeConfig();

kc.loadFromDefault();
// kc.loadFromFile('./edwinscluster-config.yaml');

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

interface KubbyController {
      getNodeView: (req:Request, res:Response, next:NextFunction) => void;
  getMetrics: () => void;
}

const totalNodes = new client.Gauge({
  name: 'kube_nodes_total',
  help: 'This is total number of nodes',
});

const totalCores = new client.Gauge({
    name: 'kube_total_cores',
    help: 'This is total number of CPU cores',
});

const totalAllocatableCores = new client.Gauge({
    name: 'kube_total_allocatable_cores',
    help: 'This is total number of allocatable CPU cores',
});

const totalMemory = new client.Gauge({
    name: 'kube_total_memory',
    help: 'This is total number of memory',
});

const totalAllocatableMemory = new client.Gauge({
    name: 'kube_total_allocatable_memory',
    help: 'This is total number of allocatable memory',
});

const containerCountPerNodeGauge = new client.Gauge({
    name: 'kube_container_count_per_node',
    help: 'Number of containers running on each Kubernetes node',
    labelNames: ['node'],
}); 

const podCountPerNodeGauge = new client.Gauge({
    name: 'kube_pod_count_per_node',
    help: 'Number of pods running on each Kubernetes node',
    labelNames: ['node'],
});

const kubbyController: KubbyController = {
    getNodeView: async (req: Request, res: Response, next: NextFunction) => {
        try {
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

            await getContainersPerNode();
            await getPodsPerNode();
            totalNodes.set(nodes.length);
            totalCores.set(cpuCores);
            totalAllocatableCores.set(allocatableCores);
            const totalMemoryRD = +convertKiBToGiB(memoryBytes).toFixed(2);
            totalMemory.set(totalMemoryRD);
            const totalAllocatableMemoryRD = +convertKiBToGiB(allocatableMemoryBytes).toFixed(2);
            totalAllocatableMemory.set(totalAllocatableMemoryRD);

            const metrics = await client.register.metrics();

            res.locals.nodeView = metrics;
            return next(); 
            
         } catch (error) { 
            next(error); // TODO: Make more robust
        }
    },
    getMetrics: async() => {

    }
}

async function getPodsPerNode() {
    try {
        const res = await k8sApi.listPodForAllNamespaces();
        const pods = res.body.items;

        const podCountPerNode: { [key: string]: number } = {};

        pods.forEach(pod => {
            const nodeName = pod?.spec?.nodeName ?? "";
            podCountPerNode[nodeName] = (podCountPerNode[nodeName] || 0) + 1;
        });

        for (const [nodeName, count] of Object.entries(podCountPerNode)) {
            podCountPerNodeGauge.labels(nodeName).set(count);
        }

    } catch (error) {
        console.error('Error fetching pods:', error);
        throw error;
    }
}

async function getContainersPerNode() {
    try {
        const res = await k8sApi.listPodForAllNamespaces();
        const pods = res.body.items;

        const containerCountPerNode: { [key: string]: number } = {};

        pods.forEach(pod => {
            const nodeName = pod?.spec?.nodeName ?? '';
            const containerCount = pod?.spec?.containers.length ?? 0;

            containerCountPerNode[nodeName] = (containerCountPerNode[nodeName] || 0) + containerCount;
        });

        for (const [nodeName, count] of Object.entries(containerCountPerNode)) {
            containerCountPerNodeGauge.labels(nodeName).set(count);
        }

    } catch (error) {
        console.error('Error fetching pods:', error);
        throw error;
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