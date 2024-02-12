import * as k8s from '@kubernetes/client-node';
import { NextFunction, Response, Request } from 'express';
import { kc, k8sApi, metricsClient } from '../k8s-client';

interface containerController {}

// We don't have any Queries being made on the client side??
