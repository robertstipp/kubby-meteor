import { NextFunction, Response, Request } from 'express';
import {
  parseKubernetesMemoryString,
  parseCpuStringToCores,
  convertKiBToGiB,
} from './kubbyController';

import axios from 'axios';
// type Data = {
//   metric?: string;
// };

// Queries for Container Usage Metrics
const host = process.env.PROMHOST || '104.198.235.133';

const podMem = axios.get(
  `http://${host}/api/v1/query?query= sum by (pod) (container_memory_usage_bytes{pod!=""})`
);
const podCpu = axios.get(
  `http://${host}/api/v1/query?query= sum by (pod) (rate(container_cpu_usage_seconds_total{pod!=""}[5m]))`
);

const namespaceMem = axios.get(
  `http://${host}/api/v1/query?query= sum by (namespace) (container_memory_usage_bytes{namespace!=""})`
);

const namespaceCpu = axios.get(
  `http://${host}/api/v1/query?query= sum by (namespace) (rate(container_cpu_usage_seconds_total{namespace!=""}[5m]))`
);

const nodeMem = axios.get(
  `http://${host}/api/v1/query?query= sum by (kubernetes_io_hostname) (rate(container_cpu_usage_seconds_total{}[5m]))`
);

const nodeCpu = axios.get(
  `http://${host}/api/v1/query?query= sum by (kubernetes_io_hostname) (container_memory_usage_bytes)`
);

interface usageMetricsController {
  getUsageMetrics: (req: Request, res: Response, next: NextFunction) => void;
}

type Data = {
  metric?: any;
  value?: any;
};

const usageMetricsController: usageMetricsController = {
  getUsageMetrics: async (req: Request, res: Response, next: NextFunction) => {
    let podMemData,
      podCpuData,
      namespaceMemData,
      namespaceCpuData,
      nodeMemData,
      nodeCpuData;
    let usageCache: any = {};
    try {
      Promise.all([
        podMem,
        podCpu,
        namespaceMem,
        namespaceCpu,
        nodeCpu,
        nodeMem,
      ]).then((responses) => {
        const [
          podMemRes,
          podCpuRes,
          namespaceMemRes,
          namespaceCpuRes,
          nodeMemRes,
          nodeCpuRes,
        ] = responses;
        const podCache: { [key: string]: any } = {};
        const nameSpaceCache: { [key: string]: any } = {};
        const nodeCache: { [key: string]: any } = {};

        podMemData = podMemRes.data.data.result;
        podCpuData = podCpuRes.data.data.result;
        namespaceCpuData = namespaceCpuRes.data.data.result;
        namespaceMemData = namespaceMemRes.data.data.result;
        nodeMemData = nodeMemRes.data.data.result;
        nodeCpuData = nodeCpuRes.data.data.result;

        podMemData.forEach((val: Data) => {
          const podName = val?.metric?.pod ?? '';
          podCache[podName] = {
            MEM: val.value[1],
          };
        });

        podCpuData.forEach((val: Data) => {
          const podName = val?.metric?.pod ?? '';
          const currentData = podCache[podName] || {};
          podCache[podName] = {
            ...currentData,
            CPU: val.value[1],
          };
        });

        namespaceMemData.forEach((val: Data) => {
          const nsName = val?.metric?.namespace ?? '';
          nameSpaceCache[nsName] = {
            MEM: val.value[1],
          };
        });

        namespaceCpuData.forEach((val: Data) => {
          const nsName = val?.metric?.namespace ?? '';
          const currentData = nameSpaceCache[nsName] || {};
          nameSpaceCache[nsName] = {
            ...currentData,
            CPU: val.value[1],
          };
        });

        nodeMemData.forEach((val: Data) => {
          const nodeName = val?.metric?.kubernetes_io_hostname ?? '';
          nodeCache[nodeName] = {
            MEM: val.value[1],
          };
        });

        nodeCpuData.forEach((val: Data) => {
          const nodeName = val?.metric?.kubernetes_io_hostname ?? '';
          const currentData = nodeCache[nodeName] || {};
          nodeCache[nodeName] = {
            ...currentData,
            CPU: val.value[1],
          };
        });

        usageCache = { pod: podCache };
        usageCache = {
          ...usageCache,
          namespace: nameSpaceCache,
          node: nodeCache,
        };
        res.locals.cUsageMetrics = usageCache;
        return next();
      });
    } catch (error) {
      console.log('Error in usageMetricsController: ', error);
    }
  },
};

export default usageMetricsController;

// QUERIES TO BUILD
// Container Usage By Pod (MEM)
// `http://104.198.235.133/api/v1/query?query= sum by (pod) (container_memory_usage_bytes{pod!=""})`
// Container Usage By Pod (CPU)
//`http://104.198.235.133/api/v1/query?query= sum by (pod) (rate(container_cpu_usage_seconds_total{pod!=""}[5m]))`

// Container Usage By Namespace (MEM)
// `http://104.198.235.133/api/v1/query?query= sum by (namespace) (container_memory_usage_bytes{namespace!=""})`
// Container Usage By Pod (Namespace) (CPU)
// `http://104.198.235.133/api/v1/query?query= sum by (namespace) (rate(container_cpu_usage_seconds_total{namespace!=""}[5m]))`

// Container Usage By Pod (Node) (CPU)
// `http://104.198.235.133/api/v1/query?query= sum by (kubernetes_io_hostname) (rate(container_cpu_usage_seconds_total{}[5m]))`
// Container Usage By Node (MEM)
// `http://104.198.235.133/api/v1/query?query= sum by (kubernetes_io_hostname) (container_memory_usage_bytes)`
// Types and Interfaces
// interface usageMetricsController {
//   getUsageMetrics: (req: Request, res: Response, next: NextFunction) => void;
// }

// MEM = BYTES
// CPU = SECONDS (Times by 100 (depends on cores) for precent of core?)
// All node instances have two cores
