// Tiger Claw — tiger_email Tool
// Allows operators to instruct the AI to send a one-off email to a prospect.
// Built natively for the V4 Stateless Architecture using Resend.

import { Resend } from 'resend';

export const tiger_email = {
  name: "tiger_email",
  description: "Use this tool to send an email to a prospect. ONLY use this if the operator explicitly asks you to send an email. Do not cold email without permission.",
  parameters: {
    type: "OBJECT",
    properties: {
      to: {
        type: "STRING",
        description: "The email address to send to.",
      },
      subject: {
        type: "STRING",
        description: "The subject line of the email.",
      },
      text: {
        type: "STRING",
        description: "The full body of the email in plain text.",
      },
    },
    required: ["to", "subject", "text"],
  },

  async execute(args: any, context: any) {
    context.logger.info("tiger_email: preparing to send", { to: args.to });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return {
        ok: false,
        error: "Server configuration missing RESEND_API_KEY environment variable.",
      };
    }

    const resend = new Resend(apiKey);
    const fromAddress = process.env.EMAIL_SENDER ?? "agents@tigerclaw.io";

    try {
      const { data, error } = await resend.emails.send({
        from: `Agent <${fromAddress}>`,
        to: args.to,
        subject: args.subject,
        text: args.text,
      });

      if (error) {
        context.logger.error("tiger_email: send failed", error);
        return { ok: false, error: error.message };
      }

      return {
        ok: true,
        output: `Successfully sent email to ${args.to}. Delivery ID: ${data?.id}`,
        data,
      };
    } catch (err: any) {
      context.logger.error("tiger_email: fatal error", err);
      return { ok: false, error: err.message ?? String(err) };
    }
  },
};
