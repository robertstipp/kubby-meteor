import * as k8s from '@kubernetes/client-node';
import { NextFunction, Response, Request } from 'express';
import { kc, k8sApi, metricsClient } from '../k8s-client';
import { convertKiBToMB } from './usageMetricsController';

interface clusterMetricsController {
  getClusterInfo: (req: Request, res: Response, next: NextFunction) => void;
  getClusterMetrics: (req: Request, res: Response, next: NextFunction) => void;
  getFlatClusterMetrics: (
    req: Request,
    res: Response,
    next: NextFunction
  ) => void;
}

interface ContainerObj {
  name: string;
  image?: string;
}

interface podObj {
  namespace: string | undefined;
  name: string | undefined;
  containers: ContainerObj[];
}

interface namespaceObj {
  [key: string]: any;
}

async function findPodsForService(serviceName: any, namespace: any) {
  try {
    // Fetch the service to get its selector
    const { body: service } = await k8sApi.readNamespacedService(
      serviceName,
      namespace
    );
    const selector: any = service?.spec?.selector;

    // Convert selector object into a selector string
    const labelSelector = Object.entries(selector)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');

    // Use the selector to find pods
    const {
      body: { items: pods },
    } = await k8sApi.listNamespacedPod(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      labelSelector
    );

    // Mapping of service to its pods
    console.log(
      `Service ${serviceName} in ${namespace} namespace has the following pods:`
    );
    pods.forEach((pod) => {
      console.log(`- ${pod?.metadata?.name}`);
    });
  } catch (error) {
    console.error('Error fetching service or pods:', error);
  }
}

const clusterMetricsController: clusterMetricsController = {
  getClusterInfo: async (req: Request, res: Response, next: NextFunction) => {
    const servicesResponse = await k8sApi.listServiceForAllNamespaces();
    servicesResponse.body.items.forEach((service) => {
      findPodsForService(service.metadata?.name, service.metadata?.namespace);
    });

    const result = await k8sApi.listPodForAllNamespaces();
    const { items } = result.body;
    const nodes: any = [];
    const namespaces: namespaceObj = {};
    for (const pod of items) {
      if (pod?.metadata?.namespace !== undefined) {
        if (namespaces[pod.metadata.namespace] === undefined) {
          namespaces[pod.metadata.namespace] = [pod?.metadata?.name];
        } else {
          namespaces[pod.metadata.namespace].push(pod?.metadata?.name);
        }
      }

      const { nodeName }: any = pod.spec;
      let nodeIndex = nodes.findIndex((el: any) => el.nodeName === nodeName);
      if (nodeIndex === -1) {
        nodes.push({ nodeName, pods: [] });
      }
      nodeIndex = nodeIndex === -1 ? nodes.length - 1 : nodeIndex;
      const { name: podName }: any = pod.metadata;
      const podObj: podObj = {
        namespace: pod?.metadata?.namespace,
        name: podName,
        containers: [],
      };
      if (pod?.spec?.containers !== undefined) {
        for (const container of pod.spec.containers) {
          const containerObj = {
            name: container.name,
            image: container.image,
          };
          podObj.containers.push(containerObj);
        }
      }

      nodes[nodeIndex].pods.push(podObj);
    }
    //{ nodes, namespaces }
    res.locals.clusterInfo = { nodes, namespaces };
    return next();
  },
  getClusterMetrics: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const result = await k8sApi.listPodForAllNamespaces();
    const podMap: any = {};
    const nodeMap: any = {};

    result.body.items.map((pod) => {
      const nodeName = pod.spec?.nodeName;
      if (nodeName !== undefined) {
        if (nodeMap[nodeName] === undefined) {
          nodeMap[nodeName] = { cpuUsage: 0, memUsage: 0, pods: [] };
        }

        const podObj = {
          name: pod.metadata?.name,
          nameSpace: pod.metadata?.namespace,
          nodeName: nodeName,
          nodeRef: nodeMap[nodeName],
        };
        // nodeMap[nodeName].pods.push(podObj);
        if (podObj.name) podMap[podObj.name] = podObj;
      }
    });

    const response = await metricsClient.getPodMetrics();
    response.items.forEach((pod) => {
      const podName = pod.metadata.name;
      const podUsageObj = {
        podName: podName,
        cpuUsage: 0,
        memUsage: 0,
        containerUsage: pod.containers,
      };
      pod.containers.forEach((container) => {
        // Temp Commented Out Name
        const { cpu, memory } = container.usage;
        const cpuNum =
          cpu.at(-1) === 'u'
            ? Number(cpu.slice(0, -1)) * 1e3
            : Number(cpu.slice(0, -1));
        const memoryNum = Number(memory.slice(0, -2));
        podUsageObj.cpuUsage += cpuNum;
        podUsageObj.memUsage += memoryNum;
      });
      if (podName !== undefined) {
        const podMapRef = podMap[podName];
        podMapRef.usage = podUsageObj;
        nodeMap[podMapRef.nodeName].pods.push(podUsageObj);
        nodeMap[podMapRef.nodeName].cpuUsage += podUsageObj.cpuUsage;
        nodeMap[podMapRef.nodeName].memUsage += podUsageObj.memUsage;
        podMap[podName].usage = podUsageObj;
      }
    });
    const clusterUsage = [];
    for (const [key, value] of Object.entries(nodeMap)) {
      const pods = nodeMap[key].pods;
      const nodeCPUUsage = nodeMap[key].cpuUsage;
      const nodeMemUsage = nodeMap[key].memUsage;
      for (const pod of pods) {
        pod.cpuPct = (pod.cpuUsage / nodeCPUUsage) * 100;
        pod.memPct = (pod.memUsage / nodeMemUsage) * 100;
      }
      const nodeObj = { name: key, ...nodeMap[key] };
      clusterUsage.push(nodeObj);
    }
    res.locals.clusterMetrics = clusterUsage;
    return next();
  },
  getFlatClusterMetrics: async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const result = await k8sApi.listPodForAllNamespaces();
    const podMap: any = {};
    const nodeMap: any = {};

    result.body.items.map((pod) => {
      const nodeName = pod.spec?.nodeName;
      if (nodeName !== undefined) {
        if (nodeMap[nodeName] === undefined) {
          nodeMap[nodeName] = { cpuUsage: 0, memUsage: 0, pods: [] };
        }
        if (pod.metadata?.name) {
          const podObj = {
            name: pod.metadata?.name,
            nameSpace: pod.metadata?.namespace,
            nodeName: nodeName,
            nodeRef: nodeMap[nodeName],
          };
          podMap[podObj.name] = podObj;
        }
      }
    });

    const response = await metricsClient.getPodMetrics();
    const clusterUsage: any = {};
    response.items.forEach((pod) => {
      const podName = pod.metadata.name;
      const podUsageObj = {
        podName: podName,
        cpuUsage: 0,
        memUsage: 0,
        containerUsage: pod.containers,
      };
      pod.containers.forEach((container) => {
        const { cpu, memory } = container.usage;
        const { name } = container;
        const containerKey = `${name}/${podName}`;
        const cpuNum =
          cpu.at(-1) === 'u'
            ? Number(cpu.slice(0, -1)) * 1e3
            : Number(cpu.slice(0, -1));
        const memoryNum = Number(memory.slice(0, -2));
        clusterUsage[containerKey] = {
          cpuUsage: cpuNum,
          memUsage: memoryNum,
          type: 'container',
        };
        podUsageObj.cpuUsage += cpuNum;
        podUsageObj.memUsage += memoryNum;
      });
      const podMapRef = podMap[podName];
      pod.containers.forEach((container) => {
        const { name } = container;
        const containerKey = `${name}/${podName}`;
        clusterUsage[containerKey].cpuUsagePct =
          (clusterUsage[containerKey].cpuUsage / podUsageObj.cpuUsage) * 100 ||
          0;
        clusterUsage[containerKey].memUsagePct =
          (clusterUsage[containerKey].memUsage / podUsageObj.memUsage) * 100;
      });
      podMapRef.usage = podUsageObj;
      nodeMap[podMapRef.nodeName].pods.push(podUsageObj);
      nodeMap[podMapRef.nodeName].cpuUsage += podUsageObj.cpuUsage;
      nodeMap[podMapRef.nodeName].memUsage += podUsageObj.memUsage;
      podMap[podName].usage = podUsageObj;
    });

    for (const [key, value] of Object.entries(nodeMap)) {
      const pods = nodeMap[key].pods;
      const nodeCPUUsage = nodeMap[key].cpuUsage;
      const nodeMemUsage = nodeMap[key].memUsage;
      for (const pod of pods) {
        pod.cpuPct = (pod.cpuUsage / nodeCPUUsage) * 100;
        pod.memPct = (pod.memUsage / nodeMemUsage) * 100;
        clusterUsage[pod.podName] = {
          cpuUsage: pod.cpuUsage,
          cpuUsagePct: pod.cpuPct,
          memUsage: pod.memUsage,
          memUsagePct: pod.memPct,
          type: 'pod',
        };
      }
      const nodeObj = { name: key, ...nodeMap[key] };
      clusterUsage[key] = {
        cpuUsage: nodeObj.cpuUsage,
        memUsage: nodeObj.memUsage,
        type: 'node',
      };
    }

    const nodeInfo = await k8sApi.listNode();
    for (const node of nodeInfo.body.items) {
      if (node.status?.allocatable && node.metadata) {
        const { cpu, memory, pods } = node.status?.allocatable;
        const { name } = node.metadata;
        const cpuNum = Number(cpu.slice(0, -1)) * 1e6;
        const memNum = Number(memory.slice(0, -2));
        if (name !== undefined) {
          clusterUsage[name].cpuUtilPct =
            (clusterUsage[name].cpuUsage / cpuNum) * 100;
          clusterUsage[name].memUtilPct =
            (clusterUsage[name].memUsage / memNum) * 100;
        }
      }
    }
    res.locals.flatClusterMetrics = clusterUsage;
    return next();
  },
};

export default clusterMetricsController;
