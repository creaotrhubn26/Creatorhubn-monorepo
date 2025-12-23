/**
 * Note Templates - Pre-built templates for common note types
 * 
 * Categories:
 * - Meeting Notes
 * - Project Briefs
 * - Brainstorming
 * - Research Notes
 * - Task Planning
 * - Client Communication
 * - Weekly Reports
 * - Interview Notes
 */

export interface NoteTemplate {
  id: string;
  title: string;
  description: string;
  category: 'meeting' | 'project' | 'ideas' | 'research' | 'tasks' | 'email' | 'personal' | 'docs';
  icon: string;
  tags: string[];
  content: string;
}

export const NOTE_TEMPLATES: NoteTemplate[] = [
  // ==================== MEETING NOTES ====================
  {
    id: 'meeting-standard',
    title: 'Standard Meeting Notes',
    description: 'General meeting notes template with agenda, discussion points, and action items',
    category: 'meeting',
    icon: '📋',
    tags: ['meeting','notes','agenda'],
    content: `<h1>📋 Meeting Notes</h1>
<p><strong>Date:</strong> {{date}}</p>
<p><strong>Time:</strong> {{time}}</p>
<p><strong>Attendees:</strong> {{attendees}}</p>
<p><strong>Location:</strong> {{location}}</p>

<hr/>

<h2>📌 Agenda</h2>
<ol>
  <li>Item 1</li>
  <li>Item 2</li>
  <li>Item 3</li>
</ol>

<h2>💬 Discussion Points</h2>
<ul>
  <li><strong>Topic 1:</strong> Notes here...</li>
  <li><strong>Topic 2:</strong> Notes here...</li>
  <li><strong>Topic 3:</strong> Notes here...</li>
</ul>

<h2>✅ Action Items</h2>
<table style="width:100%; border-collapse: collapse;">
  <tr style="background: #f5f5f5;">
    <th style="padding: 8px; border: 1px solid #ddd;">Task</th>
    <th style="padding: 8px; border: 1px solid #ddd;">Owner</th>
    <th style="padding: 8px; border: 1px solid #ddd;">Due Date</th>
    <th style="padding: 8px; border: 1px solid #ddd;">Status</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;">Action item 1</td>
    <td style="padding: 8px; border: 1px solid #ddd;">@name</td>
    <td style="padding: 8px; border: 1px solid #ddd;">DD/MM/YYYY</td>
    <td style="padding: 8px; border: 1px solid #ddd;">⏳ Pending</td>
  </tr>
</table>

<h2>📝 Key Decisions</h2>
<ul>
  <li>Decision 1</li>
  <li>Decision 2</li>
</ul>

<h2>📅 Next Meeting</h2>
<p><strong>Date:</strong> TBD</p>
<p><strong>Topics to cover:</strong></p>
<ul>
  <li>Follow-up item 1</li>
  <li>Follow-up item 2</li>
</ul>`
  },
  {
    id: 'meeting-client',
    title: 'Client Meeting Notes',
    description: 'Template for client meetings with project updates and feedback',
    category: 'meeting',
    icon: '🤝',
    tags: ['client','meeting','project'],
    content: `<h1>🤝 Client Meeting Notes</h1>
<p><strong>Client:</strong> {{clientName}}</p>
<p><strong>Project:</strong> {{projectName}}</p>
<p><strong>Date:</strong> {{date}}</p>
<p><strong>Attendees:</strong> {{attendees}}</p>

<hr/>

<h2>📊 Project Status Update</h2>
<div style="background: #e8f5e9; padding: 12px; border-radius: 8px; margin: 8px 0;">
  <p><strong>Overall Status:</strong> 🟢 On Track / 🟡 At Risk / 🔴 Delayed</p>
  <p><strong>Completion:</strong> __% complete</p>
</div>

<h3>Completed Since Last Meeting</h3>
<ul>
  <li>✅ Item 1</li>
  <li>✅ Item 2</li>
</ul>

<h3>In Progress</h3>
<ul>
  <li>🔄 Item 1</li>
  <li>🔄 Item 2</li>
</ul>

<h2>💬 Client Feedback</h2>
<blockquote style="border-left: 4px solid #2196f3; padding-left: 12px; margin: 12px 0; color: #555;">"Client feedback here..."
</blockquote>

<h2>🎯 Client Requests / Changes</h2>
<ol>
  <li>Request 1 - Priority: High/Medium/Low</li>
  <li>Request 2 - Priority: High/Medium/Low</li>
</ol>

<h2>💰 Budget & Timeline</h2>
<table style="width:100%; border-collapse: collapse;">
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Budget Used:</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd;">__% of total</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;"><strong>Timeline:</strong></td>
    <td style="padding: 8px; border: 1px solid #ddd;">On schedule / Adjusted</td>
  </tr>
</table>

<h2>✅ Next Steps</h2>
<ul>
  <li>[ ] Action item 1 - Owner - Due date</li>
  <li>[ ] Action item 2 - Owner - Due date</li>
</ul>

<h2>📅 Next Meeting</h2>
<p><strong>Scheduled:</strong> {{nextMeetingDate}}</p>`
  },
  {
    id: 'meeting-standup',
    title: 'Daily Standup Notes',
    description: 'Quick daily standup meeting template',
    category: 'meeting',
    icon: '🚀',
    tags: ['standup','daily','agile'],
    content: `<h1>🚀 Daily Standup - {{date}}</h1>

<h2>👤 Team Member 1</h2>
<div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 8px 0;">
  <p><strong>✅ Yesterday:</strong></p>
  <ul><li>Completed task...</li></ul>
  <p><strong>📋 Today:</strong></p>
  <ul><li>Working on...</li></ul>
  <p><strong>🚧 Blockers:</strong></p>
  <ul><li>None / Issue...</li></ul>
</div>

<h2>👤 Team Member 2</h2>
<div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 8px 0;">
  <p><strong>✅ Yesterday:</strong></p>
  <ul><li>Completed task...</li></ul>
  <p><strong>📋 Today:</strong></p>
  <ul><li>Working on...</li></ul>
  <p><strong>🚧 Blockers:</strong></p>
  <ul><li>None / Issue...</li></ul>
</div>

<h2>🎯 Team Focus Today</h2>
<ul>
  <li>Priority 1</li>
  <li>Priority 2</li>
</ul>`
  },

  // ==================== PROJECT BRIEFS ====================
  {
    id: 'project-brief',
    title: 'Project Brief',
    description: 'Comprehensive project brief template',
    category: 'project',
    icon: '📁',
    tags: ['project','brief','planning'],
    content: `<h1>📁 Project Brief</h1>
<p><strong>Project Name:</strong> {{projectName}}</p>
<p><strong>Client:</strong> {{clientName}}</p>
<p><strong>Project Manager:</strong> {{pmName}}</p>
<p><strong>Start Date:</strong> {{startDate}}</p>
<p><strong>Deadline:</strong> {{deadline}}</p>

<hr/>

<h2>🎯 Project Overview</h2>
<p>Brief description of the project and its goals...</p>

<h2>📋 Objectives</h2>
<ol>
  <li>Primary objective</li>
  <li>Secondary objective</li>
  <li>Tertiary objective</li>
</ol>

<h2>👥 Target Audience</h2>
<p>Description of target audience/users...</p>

<h2>📦 Deliverables</h2>
<table style="width:100%; border-collapse: collapse;">
  <tr style="background: #f5f5f5;">
    <th style="padding: 8px; border: 1px solid #ddd;">Deliverable</th>
    <th style="padding: 8px; border: 1px solid #ddd;">Description</th>
    <th style="padding: 8px; border: 1px solid #ddd;">Due Date</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;">Deliverable 1</td>
    <td style="padding: 8px; border: 1px solid #ddd;">Description...</td>
    <td style="padding: 8px; border: 1px solid #ddd;">Date</td>
  </tr>
</table>

<h2>⏱️ Timeline & Milestones</h2>
<ul>
  <li><strong>Phase 1:</strong> Discovery & Planning (Week 1-2)</li>
  <li><strong>Phase 2:</strong> Design & Development (Week 3-6)</li>
  <li><strong>Phase 3:</strong> Testing & Review (Week 7-8)</li>
  <li><strong>Phase 4:</strong> Launch & Handover (Week 9)</li>
</ul>

<h2>💰 Budget</h2>
<p><strong>Total Budget:</strong> {{budget}} NOK</p>
<table style="width:100%; border-collapse: collapse;">
  <tr style="background: #f5f5f5;">
    <th style="padding: 8px; border: 1px solid #ddd;">Category</th>
    <th style="padding: 8px; border: 1px solid #ddd;">Amount</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;">Design</td>
    <td style="padding: 8px; border: 1px solid #ddd;">NOK</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;">Development</td>
    <td style="padding: 8px; border: 1px solid #ddd;">NOK</td>
  </tr>
</table>

<h2>👥 Team</h2>
<ul>
  <li><strong>Project Manager:</strong> Name</li>
  <li><strong>Designer:</strong> Name</li>
  <li><strong>Developer:</strong> Name</li>
</ul>

<h2>⚠️ Risks & Mitigation</h2>
<table style="width:100%; border-collapse: collapse;">
  <tr style="background: #fff3e0;">
    <th style="padding: 8px; border: 1px solid #ddd;">Risk</th>
    <th style="padding: 8px; border: 1px solid #ddd;">Impact</th>
    <th style="padding: 8px; border: 1px solid #ddd;">Mitigation</th>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;">Risk 1</td>
    <td style="padding: 8px; border: 1px solid #ddd;">High/Medium/Low</td>
    <td style="padding: 8px; border: 1px solid #ddd;">Mitigation strategy...</td>
  </tr>
</table>

<h2>✅ Success Criteria</h2>
<ul>
  <li>Criteria 1</li>
  <li>Criteria 2</li>
  <li>Criteria 3</li>
</ul>`
  },

  // ==================== BRAINSTORMING ====================
  {
    id: 'brainstorm-session',
    title: 'Brainstorming Session',
    description: 'Template for creative brainstorming sessions',
    category: 'ideas',
    icon: '💡',
    tags: ['brainstorm','ideas','creative'],
    content: `<h1>💡 Brainstorming Session</h1>
<p><strong>Topic:</strong> {{topic}}</p>
<p><strong>Date:</strong> {{date}}</p>
<p><strong>Participants:</strong> {{participants}}</p>

<hr/>

<h2>🎯 Problem Statement</h2>
<div style="background: #fff3e0; padding: 16px; border-radius: 8px; border-left: 4px solid #ff9800;">
  <p>What problem are we trying to solve?</p>
</div>

<h2>🧠 Ideas Generated</h2>
<div style="display: grid; gap: 12px;">
  <div style="background: #e3f2fd; padding: 12px; border-radius: 8px;">
    <strong>💭 Idea 1:</strong>
    <p>Description...</p>
    <p><em>Pros:</em> ...</p>
    <p><em>Cons:</em> ...</p>
  </div>
  <div style="background: #f3e5f5; padding: 12px; border-radius: 8px;">
    <strong>💭 Idea 2:</strong>
    <p>Description...</p>
    <p><em>Pros:</em> ...</p>
    <p><em>Cons:</em> ...</p>
  </div>
  <div style="background: #e8f5e9; padding: 12px; border-radius: 8px;">
    <strong>💭 Idea 3:</strong>
    <p>Description...</p>
    <p><em>Pros:</em> ...</p>
    <p><em>Cons:</em> ...</p>
  </div>
</div>

<h2>⭐ Top 3 Ideas (Voted)</h2>
<ol>
  <li>🥇 Top idea - X votes</li>
  <li>🥈 Second idea - X votes</li>
  <li>🥉 Third idea - X votes</li>
</ol>

<h2>✅ Next Steps</h2>
<ul>
  <li>[ ] Research feasibility of top idea</li>
  <li>[ ] Create prototype/mockup</li>
  <li>[ ] Schedule follow-up meeting</li>
</ul>`
  },

  // ==================== RESEARCH NOTES ====================
  {
    id: 'research-notes',
    title: 'Research Notes',
    description: 'Template for organizing research findings',
    category: 'research',
    icon: '🔬',
    tags: ['research','analysis','findings'],
    content: `<h1>🔬 Research Notes</h1>
<p><strong>Topic:</strong> {{topic}}</p>
<p><strong>Researcher:</strong> {{researcher}}</p>
<p><strong>Date:</strong> {{date}}</p>

<hr/>

<h2>🎯 Research Objective</h2>
<p>What are we trying to learn or discover?</p>

<h2>📚 Sources</h2>
<ol>
  <li><a href="#">Source 1</a> - Brief description</li>
  <li><a href="#">Source 2</a> - Brief description</li>
  <li><a href="#">Source 3</a> - Brief description</li>
</ol>

<h2>📊 Key Findings</h2>
<div style="background: #e8f5e9; padding: 16px; border-radius: 8px; margin: 12px 0;">
  <h3>Finding 1</h3>
  <p>Description of finding...</p>
  <p><strong>Evidence:</strong> Supporting data or quotes...</p>
</div>

<div style="background: #e3f2fd; padding: 16px; border-radius: 8px; margin: 12px 0;">
  <h3>Finding 2</h3>
  <p>Description of finding...</p>
  <p><strong>Evidence:</strong> Supporting data or quotes...</p>
</div>

<h2>📈 Data & Statistics</h2>
<ul>
  <li>Stat 1: XX%</li>
  <li>Stat 2: XX</li>
  <li>Stat 3: XX</li>
</ul>

<h2>💭 Analysis & Insights</h2>
<p>What do these findings mean? What patterns emerge?</p>

<h2>🎬 Recommendations</h2>
<ol>
  <li>Recommendation 1</li>
  <li>Recommendation 2</li>
  <li>Recommendation 3</li>
</ol>

<h2>❓ Questions for Further Research</h2>
<ul>
  <li>Question 1?</li>
  <li>Question 2?</li>
</ul>`
  },

  // ==================== TASK PLANNING ====================
  {
    id: 'weekly-plan',
    title: 'Weekly Planning',
    description: 'Template for weekly task planning',
    category: 'tasks',
    icon: '📅',
    tags: ['weekly','planning','tasks'],
    content: `<h1>📅 Weekly Plan - Week {{weekNumber}}</h1>
<p><strong>Date Range:</strong> {{startDate}} - {{endDate}}</p>

<hr/>

<h2>🎯 Weekly Goals</h2>
<ol>
  <li><strong>Goal 1:</strong> Description</li>
  <li><strong>Goal 2:</strong> Description</li>
  <li><strong>Goal 3:</strong> Description</li>
</ol>

<h2>📋 Tasks by Day</h2>

<h3>Monday</h3>
<ul>
  <li>[ ] Task 1</li>
  <li>[ ] Task 2</li>
</ul>

<h3>Tuesday</h3>
<ul>
  <li>[ ] Task 1</li>
  <li>[ ] Task 2</li>
</ul>

<h3>Wednesday</h3>
<ul>
  <li>[ ] Task 1</li>
  <li>[ ] Task 2</li>
</ul>

<h3>Thursday</h3>
<ul>
  <li>[ ] Task 1</li>
  <li>[ ] Task 2</li>
</ul>

<h3>Friday</h3>
<ul>
  <li>[ ] Task 1</li>
  <li>[ ] Task 2</li>
</ul>

<h2>📊 Weekly Review</h2>
<p><strong>Completed:</strong> X of Y tasks</p>
<p><strong>Highlights:</strong></p>
<ul><li>Achievement 1</li></ul>
<p><strong>Challenges:</strong></p>
<ul><li>Challenge 1</li></ul>
<p><strong>Next Week Focus:</strong></p>
<ul><li>Priority 1</li></ul>`
  },

  // ==================== INTERVIEW NOTES ====================
  {
    id: 'interview-notes',
    title: 'Interview Notes',
    description: 'Template for job interview or user interview notes',
    category: 'meeting',
    icon: '🎤',
    tags: ['interview','hiring','user-research'],
    content: `<h1>🎤 Interview Notes</h1>
<p><strong>Candidate/Interviewee:</strong> {{name}}</p>
<p><strong>Position/Topic:</strong> {{position}}</p>
<p><strong>Date:</strong> {{date}}</p>
<p><strong>Interviewer(s):</strong> {{interviewers}}</p>

<hr/>

<h2>📋 Background</h2>
<ul>
  <li><strong>Experience:</strong> X years</li>
  <li><strong>Current Role:</strong> Role at Company</li>
  <li><strong>Education:</strong> Degree, Institution</li>
</ul>

<h2>💬 Questions & Responses</h2>

<h3>Q1: Tell me about yourself</h3>
<div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 8px 0;">
  <p>Response summary...</p>
</div>

<h3>Q2: [Technical/Behavioral Question]</h3>
<div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 8px 0;">
  <p>Response summary...</p>
</div>

<h3>Q3: [Situational Question]</h3>
<div style="background: #f5f5f5; padding: 12px; border-radius: 8px; margin: 8px 0;">
  <p>Response summary...</p>
</div>

<h2>⭐ Strengths</h2>
<ul>
  <li>Strength 1</li>
  <li>Strength 2</li>
</ul>

<h2>⚠️ Areas of Concern</h2>
<ul>
  <li>Concern 1</li>
  <li>Concern 2</li>
</ul>

<h2>📊 Rating</h2>
<table style="width:100%; border-collapse: collapse;">
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;">Technical Skills</td>
    <td style="padding: 8px; border: 1px solid #ddd;">⭐⭐⭐⭐⭐</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;">Communication</td>
    <td style="padding: 8px; border: 1px solid #ddd;">⭐⭐⭐⭐⭐</td>
  </tr>
  <tr>
    <td style="padding: 8px; border: 1px solid #ddd;">Culture Fit</td>
    <td style="padding: 8px; border: 1px solid #ddd;">⭐⭐⭐⭐⭐</td>
  </tr>
</table>

<h2>✅ Recommendation</h2>
<div style="background: #e8f5e9; padding: 16px; border-radius: 8px;">
  <p><strong>Decision:</strong> 👍 Proceed / 👎 Pass / 🤔 Need More Info</p>
  <p><strong>Reasoning:</strong> ...</p>
</div>`
  },
];

export default NOTE_TEMPLATES;