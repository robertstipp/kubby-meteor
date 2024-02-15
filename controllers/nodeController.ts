import * as k8s from '@kubernetes/client-node';
import { NextFunction, Response, Request } from 'express';
import { kc, k8sApi, metricsClient } from '../k8s-client';

interface nodeMetricsController {
  getNodeStats: (req: Request, res: Response, next: NextFunction) => void;
}

const nodeMetricsController: nodeMetricsController = {
  getNodeStats: async (req: Request, res: Response, next: NextFunction) => {
    try {
      const response = await metricsClient.getNodeMetrics();
      const { items } = response;
      const nodes = [];
      for (const node of items) {
        nodes.push({
          nodeName: node.metadata.name,
          usage: node.usage,
        });
      }
      res.locals.nodeStats = nodes;
      return next();
    } catch (err) {
      console.log(err);
    }
  },
};

export default nodeMetricsController;
