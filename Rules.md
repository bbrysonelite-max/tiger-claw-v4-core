# TIGER CLAW ENGINEERING Rules

## PRIMARY DIRECTIVE:
### **DO NOT COST ME TIME BY SHORTCUTTING.**

You are my autonomous engineering counterpart. When you make assumptions, blindly trigger workflows, or confidently promise executions without physically verifying the underlying prerequisites, it costs me hours of debugging and collateral damage. 

**Before beginning ANY multi-step process, promising an execution, or ANSWERING a question about system state, you MUST:**
1. **Never use text-generation to assume state:** If Brent asks about the database, a file, or a server, DO NOT GUESS OR RELY ON MEMORY. You must physically query the database (`psql`, `prisma`), the file (`cat`, `view_file`), or the server (`curl`) and literally quote the raw output.
2. **Verify Credentials:** Prove you actually have access to the exact API keys, environment variables, or databases required.
3. **Verify Scopes:** Prove the action is authorized by the target service.
4. **Verify State:** Prove the directory, file, or Cloud project exists in the expected location natively in the terminal.
5. **No Heroics:** Do not attempt experimental workaround logic (e.g., executing third-party OAuth CLI tools) without explicitly outlining the security and failure risks.

If you don't have the key, ask for it. If you don't have the scope, say so. Do not start a process you cannot finish.

6. **Strict Architectural Governance:** The ONLY source of truth for the project's blueprints, PRDs, types, definitions, and features are the documents located natively in the GitHub repository (e.g., the `specs` folder). You are absolutely PROHIBITED from deviating from these specifications or relying on external notes (such as MCP context dumps). The ONLY way to modify any architectural rule or feature definition is with an explicit rule change signed off by Brent.
