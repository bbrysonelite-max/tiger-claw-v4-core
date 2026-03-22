import { ToolContext, ToolResult } from "./ToolContext.js";
// Tiger Claw — tiger_google_workspace Tools
// Replaces the legacy OpenClaw `@googleworkspace/cli` (gws) bash script.
// Built natively for the V4 Stateless Architecture using standard Google APIs.
//
// REQUIREMENT: To act as Brent (or any workspace user), this requires a Service
// Account JSON with Domain-Wide Delegation injected via the
// GOOGLE_SERVICE_ACCOUNT_JSON environment variable (e.g., from GCP Secret Manager).

import { google } from 'googleapis';

const DEFAULT_SUBJECT = process.env.GWS_SUBJECT ?? 'bbrysonelite@gmail.com';

/**
 * Helper to acquire a JWT client using the injected Service Account JSON
 * with Domain-Wide Delegation to impersonate the default subject.
 */
function getGwsAuthClient() {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!jsonStr) {
    throw new Error("Server configuration missing GOOGLE_SERVICE_ACCOUNT_JSON environment variable. Required for Google Workspace actions.");
  }
  
  const credentials = JSON.parse(jsonStr);
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/drive',
    ],
    subject: DEFAULT_SUBJECT,
  });
  return auth;
}

export const tiger_gmail_send = {
  name: "tiger_gmail_send",
  description: "Send an email directly out of the Executive Assistant's primary Google Workspace inbox. Use this for highly personalized, 1-to-1 outreach or responses rather than standard platform templates.",
  parameters: {
    type: "OBJECT",
    properties: {
      to: {
        type: "STRING",
        description: "The recipient's email address.",
      },
      subject: {
        type: "STRING",
        description: "The email subject line.",
      },
      bodyText: {
        type: "STRING",
        description: "The plaintext body of the email.",
      },
    },
    required: ["to", "subject", "bodyText"],
  },

  async execute(args: any, context: any) {
    context.logger.info("tiger_gmail_send: preparing to send natively via Workspace", { to: args.to });

    try {
      const auth = getGwsAuthClient();
      const gmail = google.gmail({ version: 'v1', auth });

      // Build RFC822 message
      const utf8Subject = `=?utf-8?B?${Buffer.from(args.subject).toString('base64')}?=`;
      const messageParts = [
        `To: ${args.to}`,
        `Subject: ${utf8Subject}`,
        `Content-Type: text/plain; charset=utf-8`,
        `MIME-Version: 1.0`,
        ``,
        args.bodyText,
      ];
      const message = messageParts.join('\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      return {
        ok: true,
        output: `Successfully sent email from Workspace to ${args.to}. Delivery ID: ${res.data.id}`,
      };
    } catch (err: any) {
      context.logger.error("tiger_gmail_send: fatal error", err);
      return { ok: false, error: err.message ?? String(err) };
    }
  },
};

export const tiger_drive_list = {
  name: "tiger_drive_list",
  description: "Search and list files in the Executive Assistant's Google Drive. Returns the most recent files or files matching a specific search query.",
  parameters: {
    type: "OBJECT",
    properties: {
      query: {
        type: "STRING",
        description: "Optional Google Drive search query (e.g., \"name contains 'Tiger'\"). Leave blank to just list recent files.",
      },
      limit: {
        type: "INTEGER",
        description: "Maximum number of files to return (default 5).",
      },
    },
    required: [],
  },

  async execute(args: any, context: any) {
    context.logger.info("tiger_drive_list: querying Drive natively", { query: args.query });

    try {
      const auth = getGwsAuthClient();
      const drive = google.drive({ version: 'v3', auth });

      const res = await drive.files.list({
        q: args.query ? args.query : undefined,
        pageSize: args.limit || 5,
        fields: 'files(id, name, mimeType, modifiedTime)',
        orderBy: 'modifiedTime desc',
      });

      const files = res.data.files || [];
      if (files.length === 0) {
        return { ok: true, output: "No files found matching the criteria." };
      }

      // Format as markdown table for the Agent to easily read
      const tableLines = ['| Name | ID | Type | Modified |', '|---|---|---|---|'];
      files.forEach(f => {
        tableLines.push(`| ${f.name} | ${f.id} | ${f.mimeType} | ${f.modifiedTime} |`);
      });

      return {
        ok: true,
        output: tableLines.join('\n'),
      };
    } catch (err: any) {
      context.logger.error("tiger_drive_list: fatal error", err);
      // Helpful hint if Drive scope fails
      if (err.message?.includes('accessNotConfigured')) {
         return { ok: false, error: "Cloud Run Service Account has not enabled the Google Drive API in GCP console, or Domain-Wide Delegation is disabled." };
      }
      return { ok: false, error: err.message ?? String(err) };
    }
  },
};
