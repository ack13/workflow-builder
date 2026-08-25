import { NodeHandler } from '../../types';
import { nextNodeId } from '../graph';
import { sendEmail } from '../../services/emailService';
import * as store from '../../db/store';

// data: { channel: 'email', to: string (template, e.g. "{{applicant.email}}"), subject, body }
export const communicateHandler: NodeHandler = {
  async execute(node, graph, execution) {
    const to = resolveTemplate(node.data?.to, execution.context);
    const subject = resolveTemplate(node.data?.subject, execution.context);
    const result = await sendEmail({
      to,
      subject,
      body: resolveTemplate(node.data?.body, execution.context),
    });
    await store.logStep(execution.id, node.id, node.type, 'email_sent', {
      recipient: to,
      subject,
      messageId: result.id,
      delivery: 'mock',
      delivered: false,
    });
    return { action: 'continue', nextNodeId: nextNodeId(graph, node.id) };
  },
};

// Very small {{path.to.value}} substitution against execution context.
function resolveTemplate(template: string | undefined, context: Record<string, any>): string {
  if (!template) return '';
  return template.replace(/{{\s*([\w.]+)\s*}}/g, (_, path) => {
    const val = path.split('.').reduce((acc: any, key: string) => (acc == null ? acc : acc[key]), context);
    return val ?? '';
  });
}
