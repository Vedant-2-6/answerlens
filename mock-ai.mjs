import http from 'http';

const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    
    let content = "{}";
    
    try {
      const body = Buffer.concat(chunks).toString('utf8');
      const json = JSON.parse(body);
      const messages = json.messages || [];
      const sysMsg = messages.find(m => m.role === 'system');
      const sysStr = sysMsg ? sysMsg.content : "";
      
      console.log("System Prompt Snippet:", sysStr.substring(0, 50));
      
      if (sysStr.includes('grading rubric')) {
        content = JSON.stringify([{ id: "1", text: "Mock point", weight: 5, required: false }]);
      } else if (sysStr.includes('examination mapping')) {
        content = JSON.stringify({ 
          mappings: [
            { questionId: "Q-Q1-0", pagesSpanned: [1], confidence: 0.9, interleaved: false }
          ] 
        });
      } else if (sysStr.includes('expert grader')) {
        content = JSON.stringify({ 
          rubricVerdicts: [
            { pointId: "1", verdict: "met", justification: "Good mock logic" }
          ] 
        });
      } else if (sysStr.includes('extract handwritten student answers')) {
        content = JSON.stringify({
          pageIndex: 1,
          pageEmpty: false,
          orientationSuspect: false,
          blocks: [{
            index: 0,
            kind: "answer",
            text: "This is a mock answer",
            label: "Q1",
            note: null,
            illegibleSpans: 0,
            approxTopFraction: 0.0,
            approxBottomFraction: 0.5,
            continuedFromPrevious: false,
            continuesToNextPage: false
          }]
        });
      } else if (sysStr.includes('You extract the structure')) {
        content = JSON.stringify({ 
          questions: [{ 
            labelRaw: "Q1",
            parentLabel: null,
            depth: 0,
            text: "Question 1 mock",
            marks: 10,
            answerable: true,
            uncertain: false,
            sourceLines: ["p1:l1"]
          }], 
          sections: [], 
          choiceGroups: [], 
          paperMaxMarks: 10, 
          suspicious: [] 
        });
      } else {
        console.log("NO MATCH! sysStr was: " + sysStr.substring(0, 50));
      }
    } catch(e) {
      console.log("ERROR parsing body:", e);
    }
    
    res.end(JSON.stringify({
      choices: [{ message: { content } }]
    }));
  });
});

server.listen(3001, '127.0.0.1', () => console.log('Mock AI running on 127.0.0.1:3001'));
