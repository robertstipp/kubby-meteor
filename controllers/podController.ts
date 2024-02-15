import * as k8s from '@kubernetes/client-node';
import { NextFunction, Response, Request } from 'express';
import { kc, k8sApi, metricsClient } from '../k8s-client';

interface podMetricsController {
  getPodResources: (req: Request, res: Response, next: NextFunction) => void;
  getPodStats: (req: Request, res: Response, next: NextFunction) => void;
}

const getNodeResources = async () => {
  const result = await k8sApi.listNode();
  const { items } = result.body;

  const nodeArr = items.map((node) => {
    return {
      nodeName: node?.metadata?.name,
      resources: {
        memory: {
          allocatable: node?.status?.allocatable?.memory,
          capacity: node?.status?.capacity?.memory,
          requested: 0,
        },
        cpu: {
          allocatable: node.status?.allocatable?.cpu,
          capacity: node.status?.capacity?.cpu,
          requested: 0,
        },
        pods: {
          allocatable: node.status?.allocatable?.pods,
          capacity: node.status?.capacity?.pods,
          requested: 0,
          usage: 0,
        },
      },
    };
  });
  nodeArr.forEach((node) => console.log(node.resources));
  return nodeArr;
};

const podMetricsController: podMetricsController = {
  getPodResources: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await k8sApi.listPodForAllNamespaces();
      const { items } = result.body;
      const nodes = await getNodeResources();
      for (const pod of items) {
        const node: any =
          nodes[
            nodes.findIndex((node) => node.nodeName === pod?.spec?.nodeName)
          ];
        if (node.pods === undefined) node.pods = [];
        const podObj: any = {
          podName: pod?.metadata?.name,
          containers: [],
        };
        if (pod.spec !== undefined && pod.status?.containerStatuses) {
          for (let i = 0; i < pod.spec.containers.length; i++) {
            const containerObj = {
              name: pod.spec?.containers[i].name,
              image: pod.spec?.containers[i].image,
              resourcesRequested: pod.spec?.containers[i]?.resources?.requests,
              // CAN BE MADE BETTER
              state: pod?.status?.containerStatuses[i].state?.running
                ? true
                : false,
            };
            podObj.containers.push(containerObj);
          }
        }

        node.pods.push(podObj);
        // Temp added usage to POD
        node.resources.pods.usage += 1;
      }
      res.locals.podResources = nodes;
      return next();
    } catch (error) {
      return next({
        log: 'Error occurred obtaining pod resource data',
        status: 400,
        message: { error: 'Error in podMetricsController' },
      });
    }
  },
  getPodStats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await metricsClient.getPodMetrics();
      const { items } = response;
      const pods = [];
      for (const pod of items) {
        const podObj: any = {
          podName: pod.metadata.name,
          containers: [],
        };

        for (const container of pod.containers) {
          const containerObj = {
            name: container.name,
            usage: container.usage,
          };
          podObj.containers.push(containerObj);
        }
        pods.push(podObj);
      }
      res.locals.podStats = pods;
      return next();
    } catch (err) {
      return next({
        log: 'Error occurred obtaining pod stats data',
        status: 400,
        message: { error: 'Error in podMetricsController' },
      });
    }
  },
};

export default podMetricsController;
