import express from 'express';
import { Request, Response } from 'express';
import usageMetricsController from '../controllers/usageMetricsController';
import kubbyController from '../controllers/kubbyController';
import clusterMetricsController from '../controllers/clusterController';
import podMetricsController from '../controllers/podController';
import nodeMetricsController from '../controllers/nodeController';

const metricsRouter = express.Router();

metricsRouter.get(
  '/usage-metrics',
  usageMetricsController.getUsageMetrics,
  (req: Request, res: Response): void => {
    if (res.locals.cUsageMetrics) {
      res.status(200).json(res.locals.cUsageMetrics);
    } else {
      res
        .status(400)
        .send({ message: 'Container usage metrics info not found' });
    }
  }
);

metricsRouter.get(
  '/node-view',
  kubbyController.getNodeView,
  (req: Request, res: Response): void => {
    if (res.locals.nodeView) {
      res.status(200).json(res.locals.nodeView);
    } else {
      res.status(400).send({ message: 'Node view info not found' });
    }
  }
);

metricsRouter.get(
  '/clusterInfo',
  clusterMetricsController.getClusterInfo,
  (req: Request, res: Response) => {
    if (res.locals.clusterInfo) {
      res.status(200).json(res.locals.clusterInfo);
    } else {
      res.status(400).send({ message: 'Cluster info not found' });
    }
  }
);
//  const data = await getPodResources();
metricsRouter.get(
  '/podResources',
  podMetricsController.getPodResources,
  (req: Request, res: Response) => {
    if (res.locals.podResources) {
      res.status(200).json(res.locals.podResources);
    } else {
      res.status(400).send({ message: 'Pod resources info not found' });
    }
  }
);

metricsRouter.get(
  '/podStats',
  podMetricsController.getPodStats,
  (req: Request, res: Response) => {
    if (res.locals.podStats) {
      res.status(200).json(res.locals.podStats);
    } else {
      res.status(400).send({ message: 'Pod stats info not found' });
    }
  }
);

metricsRouter.get(
  '/nodeStats',
  nodeMetricsController.getNodeStats,
  (req: Request, res: Response) => {
    if (res.locals.nodeStats) {
      res.status(200).json(res.locals.nodeStats);
    } else {
      res.status(400).send({ message: 'Node stats info not found' });
    }
  }
);

metricsRouter.get(
  '/clusterMetrics',
  clusterMetricsController.getClusterMetrics,
  (req, res) => {
    if (res.locals.clusterMetrics) {
      res.status(200).json(res.locals.clusterMetrics);
    } else {
      res.status(400).send({ message: 'Cluster metrics info not found' });
    }
  }
);

metricsRouter.get(
  '/clusterMetricsMap',
  clusterMetricsController.getFlatClusterMetrics,
  async (req: Request, res: Response) => {
    if (res.locals.flatClusterMetrics) {
      res.status(200).json(res.locals.flatClusterMetrics);
    } else {
      res
        .status(400)
        .send({ message: 'Flat cluster metrics map info not found' });
    }
  }
);

export default metricsRouter;
