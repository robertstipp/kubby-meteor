import * as k8s from '@kubernetes/client-node';
import { NextFunction, Response, Request } from 'express';
import { kc, k8sApi } from '../k8s-client';

interface clusterMetricsController {
  getClusterInfo: (req: Request, res: Response, next: NextFunction) => void;
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
      console.log(service.metadata?.name);
      console.log(service.metadata?.namespace);
      findPodsForService(service.metadata?.name, service.metadata?.namespace);
    });

    const result = await k8sApi.listPodForAllNamespaces();
    const { items } = result.body;
    const nodes = [];
    const namespaces = {};
    for (const pod of items) {
      if (namespaces[pod.metadata.namespace] === undefined) {
        namespaces[pod.metadata.namespace] = [pod?.metadata?.name];
      } else {
        namespaces[pod.metadata.namespace].push(pod?.metadata?.name);
      }

      const { nodeName }: any = pod.spec;
      let nodeIndex = nodes.findIndex((el) => el.nodeName === nodeName);
      if (nodeIndex === -1) {
        nodes.push({ nodeName, pods: [] });
      }
      nodeIndex = nodeIndex === -1 ? nodes.length - 1 : nodeIndex;
      const { name: podName }: any = pod.metadata;
      const podObj = {
        namespace: pod?.metadata?.namespace,
        name: podName,
        containers: [],
      };

      for (const container of pod.spec.containers) {
        const containerObj = {
          name: container.name,
          image: container.image,
        };
        podObj.containers.push(containerObj);
      }

      nodes[nodeIndex].pods.push(podObj);
    }
    //{ nodes, namespaces }
    res.locals.clusterInfo = { nodes, namespaces };
    return next();
  },
};

export default clusterMetricsController;
