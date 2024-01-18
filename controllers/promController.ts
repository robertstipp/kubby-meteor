import client from 'prom-client'
const collectDefaultMetrics = client.collectDefaultMetrics;
const register = client.register;


collectDefaultMetrics();

interface PromController {
  getMetrics : () => void
}

const promController: PromController = {
  getMetrics: async () => {
    // This should return the current metrics in the registry

  }
}

export default promController;