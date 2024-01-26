import { NextFunction, Response, Request } from 'express';
import axios from 'axios';
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

// type Data = {
//   metric?: string;
// };

// Queries for Container Usage Metrics
const podMem = axios.get(
  `http://104.198.235.133/api/v1/query?query= sum by (pod) (container_memory_usage_bytes{pod!=""})`
);
const podCpu = axios.get(
  `http://104.198.235.133/api/v1/query?query= sum by (pod) (rate(container_cpu_usage_seconds_total{pod!=""}[5m]))`
);

const namespaceMem = axios.get(
  `http://104.198.235.133/api/v1/query?query= sum by (namespace) (container_memory_usage_bytes{namespace!=""})`
);

const namespaceCpu = axios.get(
  `http://104.198.235.133/api/v1/query?query= sum by (namespace) (rate(container_cpu_usage_seconds_total{namespace!=""}[5m]))`
);

const nodeMem = axios.get(
  `http://104.198.235.133/api/v1/query?query= sum by (kubernetes_io_hostname) (rate(container_cpu_usage_seconds_total{}[5m]))`
);

const nodeCpu = axios.get(
  `http://104.198.235.133/api/v1/query?query= sum by (kubernetes_io_hostname) (container_memory_usage_bytes)`
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
    let podMemData, podCpuData;
    try {
      Promise.all([podMem, podCpu]).then((responses) => {
        const [podMemRes, podCpuRes] = responses;
        const podCache: { [key: string]: any } = {};
        podMemData = podMemRes.data.data.result;
        podCpuData = podCpuRes.data.data.result;

        podMemData.forEach((val: Data) => {
          const podName = val?.metric?.pod ?? '';
          console.log(podName.pod);
          podCache[podName] = val.value[0];
          console.log(podCache);
        });

        // console.log('POD MEM DATA ===>', podMemData);
        console.log('POD Cache ===>', podCache);

        return next();
      });
    } catch (error) {
      console.log('Error in usageMetricsController: ', error);
    }
  },
};

export default usageMetricsController;
