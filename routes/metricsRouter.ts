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
      //   console.log(res.locals.cUsageMetrics);
      res.status(200).json(res.locals.cUsageMetrics);
    } else {
      res
        .status(400)
        .send({ message: 'Container usage metrics information not found' });
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
      res.status(400).send({ message: 'Cluster information not found' });
    }
  }
);

metricsRouter.get(
  '/clusterInfo',
  clusterMetricsController.getClusterInfo,
  (req: Request, res: Response) => {
    try {
      res.status(200).json(res.locals.clusterInfo);
    } catch (err) {
      console.log(err);
    }
  }
);
//  const data = await getPodResources();
metricsRouter.get(
  '/podResources',
  podMetricsController.getPodResources,
  async (req: Request, res: Response) => {
    try {
      res.status(200).json(res.locals.podResources);
    } catch (err) {
      console.log(err);
    }
  }
);

metricsRouter.get(
  '/podStats',
  podMetricsController.getPodStats,
  async (req: Request, res: Response) => {
    try {
      res.status(200).json(res.locals.podStats);
    } catch (err) {
      console.log(err);
    }
  }
);

metricsRouter.get(
  '/nodeStats',
  nodeMetricsController.getNodeStats,
  async (req: Request, res: Response) => {
    try {
      res.status(200).json(res.locals.nodeStats);
    } catch (err) {
      console.log(err);
    }
  }
);

metricsRouter.get(
  '/clusterMetrics',
  clusterMetricsController.getClusterMetrics,
  async (req, res) => {
    try {
      console.log('here', res.locals.clusterMetrics);
      res.status(200).json(res.locals.clusterMetrics);
    } catch (err) {
      console.log(err);
    }
  }
);

metricsRouter.get(
  '/clusterMetricsMap',
  clusterMetricsController.getFlatClusterMetrics,
  async (req: Request, res: Response) => {
    try {
      res.status(200).json(res.locals.flatClusterMetrics);
    } catch (err) {
      console.log(err);
    }
  }
);

export default metricsRouter;
