const WORKFLOW_ID  = '109e8eb2-507b-4573-9ab3-fce34a58107f';
const WORKFLOW_KEY = 'retool_wk_490325bf5e0648f38ad4c807f1537351';
const TRIGGER_URL  = `https://api.retool.com/v1/workflows/${WORKFLOW_ID}/startTrigger?workflowApiKey=${WORKFLOW_KEY}`;

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    let token;
    try { token = JSON.parse(event.body).token; } catch {
        return { statusCode: 400, body: JSON.stringify({ error: 'Invalid body' }) };
    }

    // Step 1: trigger the workflow
    const triggerRes = await fetch(TRIGGER_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token })
    });
    const triggerJson = await triggerRes.json();

    if (!triggerRes.ok) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Trigger failed', detail: triggerJson }) };
    }

    const runId = triggerJson.workflow_run?.id;
    if (!runId) {
        return { statusCode: 500, body: JSON.stringify({ error: 'No run ID', detail: triggerJson }) };
    }

    // Step 2: poll server-side (no CORS issue here)
    for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 700));
        const pollRes  = await fetch(
            `https://api.retool.com/v1/workflows/${WORKFLOW_ID}/runs/${runId}?workflowApiKey=${WORKFLOW_KEY}`
        );
        const poll = await pollRes.json();
        const status = poll.workflow_run?.status;

        if (status === 'COMPLETED') {
            const wr = poll.workflow_run;
            // Try every nesting shape Retool might use for the output
            const submission =
                wr?.data?.return?.data ?? wr?.data?.return ?? wr?.data ??
                wr?.output?.return?.data ?? wr?.output?.return ?? wr?.output ??
                wr?.result?.return?.data ?? wr?.result?.return ?? wr?.result;
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submission, _wr_keys: Object.keys(wr || {}) })
            };
        }

        if (status === 'FAILED') {
            return { statusCode: 500, body: JSON.stringify({ error: 'Run failed', poll }) };
        }
    }

    return { statusCode: 504, body: JSON.stringify({ error: 'Polling timed out' }) };
};
