import { NodeHandler } from '../../types';
import { nextNodeId } from '../graph';
import { sendEmail } from '../../services/emailService';

// data: { channel: 'email', to: string (template, e.g. "{{applicant.email}}"), subject, body }
export const communicateHandler: NodeHandler = {
  async execute(node, graph, execution) {
    await sendEmail({
      to: resolveTemplate(node.data?.to, execution.context),
      subject: resolveTemplate(node.data?.subject, execution.context),
      body: resolveTemplate(node.data?.body, execution.context),
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
