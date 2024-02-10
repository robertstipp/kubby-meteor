import express from 'express';
import { Request, Response } from 'express';
import usageMetricsController from '../controllers/usageMetricsController';
import kubbyController from '../controllers/kubbyController';
import clusterMetricsController from '../controllers/clusterController';

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
      console.log(req);
      res.status(200).json(res.locals.clusterInfo);
    } catch (err) {
      console.log(err);
    }
  }
);

export default metricsRouter;
