import { NextFunction, Response, Request } from 'express';
import axios from 'axios';

const host = process.env.PROMHOST || '35.227.104.153:31374';
const baseURL = `http://${host}/api/v1/query?query= `;

interface usageMetricsController {
  getUsageMetrics: (req: Request, res: Response, next: NextFunction) => void;
}

type Data = {
  metric?: any;
  value?: any;
};

const fetchData = async (query: string) => {
  try {
    const response = await axios.get(`${baseURL}${query}`);
    return response.data.data.result;
  } catch (error) {
    return console.log(`Error Fetching Data: ${error}`);
  }
};

const processCpuData = (cpuData: any, key: string, cache: any) => {
  cpuData.forEach((val: Data) => {
    const name = val?.metric?.[key] ?? '';
    const currentData = cache[name] || {};
    cache[name] = { ...currentData, CPU: Number(val?.value[1]) };
  });
};

const processMemData = (memData: any, key: string, cache: any) => {
  memData.forEach((val: Data) => {
    const name = val?.metric?.[key] ?? '';
    const currentData = cache[name] || {};
    cache[name] = { ...currentData, MEM: Number(val?.value[1]) };
  });
};

const arrayConversion = (cache: any) => {
  const array = [];
  for (const metric in cache) {
    array.push({ [metric]: cache[metric] });
  }
  return array;
};

const usageMetricsController: usageMetricsController = {
  getUsageMetrics: async (req: Request, res: Response, next: NextFunction) => {
    let usageCache: any = {};
    const podCache: { [key: string]: any } = {},
      nameSpaceCache: { [key: string]: any } = {},
      nodeCache: { [key: string]: any } = {};

    try {
      const [
        podMemData,
        podCpuData,
        namespaceMemData,
        namespaceCpuData,
        nodeCpuData,
        nodeMemData,
      ] = await Promise.all([
        fetchData('sum by (pod) (container_memory_usage_bytes{pod!=""})'),
        fetchData(
          'sum by (pod) (rate(container_cpu_usage_seconds_total{pod!=""}[5m]))'
        ),
        fetchData(
          'sum by (namespace) (container_memory_usage_bytes{namespace!=""})'
        ),
        fetchData(
          'sum by (namespace) (rate(container_cpu_usage_seconds_total{namespace!=""}[5m]))'
        ),
        fetchData(
          'sum by (kubernetes_io_hostname) (rate(container_cpu_usage_seconds_total{}[5m]))'
        ),
        fetchData(
          'sum by (kubernetes_io_hostname) (container_memory_usage_bytes)'
        ),
      ]);

      processCpuData(podCpuData, 'pod', podCache);
      processMemData(podMemData, 'pod', podCache);
      processCpuData(nodeCpuData, 'kubernetes_io_hostname', nodeCache);
      processMemData(nodeMemData, 'kubernetes_io_hostname', nodeCache);
      processCpuData(namespaceCpuData, 'namespace', nameSpaceCache);
      processMemData(namespaceMemData, 'namespace', nameSpaceCache);

      // Place Convert Organized Caches to Arrays for Front
      // console.log('Check for data', podCache);
      const podArr = arrayConversion(podCache);
      const nameSpaceArr = arrayConversion(nameSpaceCache);
      const nodeArr = arrayConversion(nodeCache);

      usageCache = {
        pod: podArr,
        namespace: nameSpaceArr,
        node: nodeArr,
      };
      res.locals.cUsageMetrics = usageCache;
      return next();
    } catch (error: any) {
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
