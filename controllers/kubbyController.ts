import k8s = require('@kubernetes/client-node');
import { NextFunction, Response, Request } from 'express';
import client from 'prom-client';
import { kc, k8sApi } from '../k8s-client';

const KubeNamespace = 'kube-system';

// kc.loadFromFile('./config.yaml');
// const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
// console.log('api', k8sApi);

interface KubbyController {
  getNodeView: (req: Request, res: Response, next: NextFunction) => void;
  // getNodeView: () => void;
  getClusterMetrics: () => void;
}

interface PrometheusData {
  metricName: string;
  // Define other properties of your Prometheus data here
}
interface MetricsConfig {
  cpuUsage?: string;
  memoryUsage?: string;
}
interface KubernetesServices {
  [serviceName: string]: MetricsConfig;
}
interface KubernetesNamespaces {
  [namespaceName: string]: MetricsConfig;
}
interface KubernetesWorkLoads {
  [workLoadName: string]: MetricsConfig;
}

const totalNodes = new client.Gauge({
  name: 'kube_nodes_total',
  help: 'This is total number of nodes',
  labelNames: ['current_context'],
});

const totalCores = new client.Gauge({
  name: 'kube_total_cores',
  help: 'This is total number of CPU cores',
  labelNames: ['current_context'],
});

const totalAllocatableCores = new client.Gauge({
  name: 'kube_total_allocatable_cores',
  help: 'This is total number of allocatable CPU cores',
  labelNames: ['current_context'],
});

const totalMemory = new client.Gauge({
  name: 'kube_total_memory',
  help: 'This is total number of memory',
  labelNames: ['current_context'],
});

const totalAllocatableMemory = new client.Gauge({
  name: 'kube_total_allocatable_memory',
  help: 'This is total number of allocatable memory',
  labelNames: ['current_context'],
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
    // getNodeView: async()=> {
    try {
      const currentContext = kc.currentContext;
      const nodeResponse = await k8sApi.listNode();
      const nodes = nodeResponse.body.items;
      totalNodes.set(nodes.length);

      let cpuCores = 0;
      let allocatableCores = 0;
      let memoryBytes = 0;
      let allocatableMemoryBytes = 0;

      nodes.forEach((node) => {
        // console.log(node);
        if (node.status?.capacity) {
          cpuCores += parseInt(node.status.capacity.cpu);
          memoryBytes += parseKubernetesMemoryString(
            node.status.capacity.memory
          );
        }
        if (node.status?.allocatable) {
          allocatableCores += parseCpuStringToCores(
            node.status.allocatable.cpu
          );
          allocatableMemoryBytes += parseKubernetesMemoryString(
            node.status.allocatable.memory
          );
        }
      });

      await getContainersPerNode();
      await getPodsPerNode();

      totalNodes.labels(currentContext).set(nodes.length);
      totalCores.labels(currentContext).set(cpuCores);
      totalAllocatableCores.labels(currentContext).set(allocatableCores);

      const totalMemoryRD = +convertKiBToGiB(memoryBytes).toFixed(2);
      totalMemory.labels(currentContext).set(totalMemoryRD);

      const totalAllocatableMemoryRD = +convertKiBToGiB(
        allocatableMemoryBytes
      ).toFixed(2);
      totalAllocatableMemory
        .labels(currentContext)
        .set(totalAllocatableMemoryRD);

      const metrics = await client.register.metrics();

      // TODO: Should me moved to a separate function
      const groupedPrometheusData: {
        [key: string]: PrometheusData | PrometheusData[];
      } = parsePrometheusData(metrics).reduce((acc, curr) => {
        if (curr) {
          // Check if the entry exists and is an array
          if (acc[curr.metricName] && Array.isArray(acc[curr.metricName])) {
            // It's an array, so we can safely push
            (acc[curr.metricName] as PrometheusData[]).push({ ...curr });
          } else if (acc[curr.metricName]) {
            // It exists but it's not an array, turn it into an array
            acc[curr.metricName] = [
              acc[curr.metricName] as PrometheusData,
              { ...curr },
            ];
          } else {
            // Initialize as a single object
            acc[curr.metricName] = { ...curr };
          }
        }
        return acc;
      }, {} as { [key: string]: PrometheusData | PrometheusData[] });

      res.locals.nodeView = groupedPrometheusData;
      return next();
    } catch (error) {
      // next(error); // TODO: Make more robust
      console.error('Error fetching nodes:', error);
    }
  },
  getClusterMetrics: async () => {
    // console.log("Kubernetes Config", kc);
    // console.log("Kubernetes API", k8sApi);

    const OBJECT: {
      KubernetesServices: KubernetesServices;
      KubernetesNamespaces: KubernetesNamespaces;
    } = {
      KubernetesServices: {},
      KubernetesNamespaces: {},
    };
    try {
      const namespaces = await k8sApi.listNamespace();
      namespaces.body.items.forEach((namespace) => {
        if (namespace.metadata?.name) {
          // console.log(namespace.metadata)
          OBJECT.KubernetesNamespaces[namespace.metadata?.name] = {};
        }
      });

      const namespacedService = await k8sApi.listServiceForAllNamespaces();
      namespacedService.body.items.forEach((service) => {
        if (service.metadata?.name) {
          // console.log(Object.keys(service.spec))
          console.log(service.spec);
          OBJECT.KubernetesServices[service.metadata?.name] = {};
        }
      });

      return OBJECT;
    } catch (error) {
      console.error('Error fetching nodes:', error);
    }
  },
};

function groupParsedPrometheusData(parsedPrometheusData: PrometheusData[]) {
  return parsedPrometheusData.reduce((acc, curr) => {
    if (curr) {
      // Check if the entry exists and is an array
      if (acc[curr.metricName] && Array.isArray(acc[curr.metricName])) {
        // It's an array, so we can safely push
        (acc[curr.metricName] as PrometheusData[]).push({ ...curr });
      } else if (acc[curr.metricName]) {
        // It exists but it's not an array, turn it into an array
        acc[curr.metricName] = [
          acc[curr.metricName] as PrometheusData,
          { ...curr },
        ];
      } else {
        // Initialize as a single object
        acc[curr.metricName] = { ...curr };
      }
    }
    return acc;
  }, {} as { [key: string]: PrometheusData | PrometheusData[] });
}

function parsePrometheusData(data: string) {
  // Regular expression to parse the metric line
  const metricRegex = /^(.+)\{(.+)\}\s+(\d+(\.\d+)?)$/;

  // Split data into lines and filter out empty lines and comments
  const lines = data
    .split('\n')
    .filter((line) => line && !line.startsWith('#'));
  return lines
    .map((line) => {
      // console.log(line);
      const match = line.match(metricRegex);
      if (match) {
        const [, metricName, labelString, metricValue] = match;

        // Parse labels
        const labels: { [key: string]: string } = {};
        labelString.split(',').forEach((labelPart) => {
          const [key, value] = labelPart.split('=');
          labels[key.trim()] = value.trim().replace(/(^"|"$)/g, ''); // Remove surrounding quotes
        });

        return { metricName, labels, metricValue };
      }
      return null;
    })
    .filter(Boolean); // Filter out any nulls (in case of non-matching lines)
}

async function getPodsPerNode() {
  try {
    const res = await k8sApi.listPodForAllNamespaces();
    const pods = res.body.items;

    const podCountPerNode: { [key: string]: number } = {};

    pods.forEach((pod) => {
      const nodeName = pod?.spec?.nodeName ?? '';
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

    pods.forEach((pod) => {
      const nodeName = pod?.spec?.nodeName ?? '';
      const containerCount = pod?.spec?.containers.length ?? 0;

      containerCountPerNode[nodeName] =
        (containerCountPerNode[nodeName] || 0) + containerCount;
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
  return kibytes / Math.pow(2, 30); // 1048576 is 2^20
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
