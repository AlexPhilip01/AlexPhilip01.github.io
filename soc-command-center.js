/* SHIELD SOC command centre — all events are synthetic and all triage state stays in this page. */
(() => {
  const list = document.getElementById('soc-event-list');
  if (!list) return;

  const events = [
    {id:'SIM-012',severity:'CRITICAL',title:'SSH authentication burst',asset:'lab-srv-ssh-01',source:'203.0.113.41',time:'T+00:54',tactic:'Credential Access',summary:'Repeated failed SSH authentication attempts against a single lab host crossed the demonstration threshold.',evidence:['42 failed authentication attempts across 6 minutes','One synthetic source address targeting one test asset','Pattern resembles credential guessing; successful access is not established'],actions:['Check authentication logs for any successful login following the failures.','Confirm whether this source should be allowed to reach the SSH service.','If this were a real environment, apply approved rate-limiting and access controls.'],status:'New'},
    {id:'SIM-011',severity:'HIGH',title:'Suspicious PowerShell pattern',asset:'lab-ws-07',source:'192.0.2.55',time:'T+00:51',tactic:'Execution',summary:'A synthetic endpoint event contains command-line characteristics that deserve analyst review.',evidence:['Encoded-command-like argument in demo process metadata','No actual command was executed by this dashboard','Context and parent process are not supplied in the simulated record'],actions:['Review process lineage and command-line logging on the endpoint.','Validate the user, parent process and maintenance context.','Collect relevant telemetry before concluding the activity is malicious.'],status:'New'},
    {id:'SIM-010',severity:'HIGH',title:'Repeated requests to /admin',asset:'lab-web-edge-02',source:'198.51.100.27',time:'T+00:48',tactic:'Initial Access',summary:'Multiple unauthenticated requests to an administrative path appear in the synthetic web-log sample.',evidence:['Repeated HTTP 401 responses in the sample','Requests concentrated on an administrative route','No successful authentication is represented in this record'],actions:['Correlate request timestamps with identity-provider and web-server logs.','Check whether the route should be publicly reachable.','Use rate controls and access restrictions where appropriate.'],status:'Investigating'},
    {id:'SIM-009',severity:'MEDIUM',title:'DNS NXDOMAIN burst',asset:'lab-ws-04',source:'198.51.100.88',time:'T+00:45',tactic:'Command and Control',summary:'A test host produces a burst of unresolved DNS lookups; the pattern is ambiguous without domain context.',evidence:['Repeated negative DNS responses in a synthetic sequence','Domain names are intentionally omitted from this example','Benign misconfiguration can produce similar behaviour'],actions:['Review queried domains and compare with normal host behaviour.','Check whether a software update or configuration change explains the burst.','Escalate only if additional evidence supports a threat hypothesis.'],status:'New'},
    {id:'SIM-008',severity:'MEDIUM',title:'Local admin group membership changed',asset:'lab-win-02',source:'192.0.2.76',time:'T+00:42',tactic:'Privilege Escalation',summary:'A synthetic Windows event indicates a new member was added to a local administrator group.',evidence:['Group-membership change recorded in the demo event','Actor and approval context require confirmation','No actual Windows host is connected to this console'],actions:['Validate the change against an approved request or change ticket.','Review the actor identity and nearby authentication events.','Remove unauthorised membership following your environment’s response procedure.'],status:'New'},
    {id:'SIM-007',severity:'HIGH',title:'SQL injection probe pattern',asset:'lab-app-01',source:'203.0.113.86',time:'T+00:39',tactic:'Initial Access',summary:'Request strings in the simulated web sample resemble common injection probes.',evidence:['Repeated query parameters with suspicious syntax','Sample does not include evidence of successful exploitation','Application response and server-side logs would be needed for confirmation'],actions:['Validate server-side input handling and parameterised queries.','Correlate response codes, error logs and endpoint telemetry.','Preserve relevant request samples for engineering review.'],status:'New'},
    {id:'SIM-006',severity:'MEDIUM',title:'Unusual outbound data volume',asset:'lab-db-01',source:'192.0.2.42',time:'T+00:35',tactic:'Exfiltration',summary:'A synthetic traffic summary shows outbound volume above the example baseline.',evidence:['Demo byte count is above a fictional normal range','Destination and process attribution are intentionally incomplete','High traffic can be caused by approved backups or replication'],actions:['Compare destination, process and timing with approved data flows.','Check backup, replication and maintenance schedules.','Use data-loss controls only after validating the underlying evidence.'],status:'Investigating'},
    {id:'SIM-005',severity:'MEDIUM',title:'Port-scan-like connection burst',asset:'lab-dmz-01',source:'198.51.100.71',time:'T+00:31',tactic:'Reconnaissance',summary:'A test telemetry row represents one source touching several ports in a short interval.',evidence:['Multiple destination ports within a simulated short window','No live packets are captured by this portfolio feature','Inventory and firewall policy determine whether the pattern is expected'],actions:['Compare activity with authorised vulnerability-scanning windows.','Check firewall and flow records for destination spread.','Confirm ownership before treating the source as hostile.'],status:'New'},
    {id:'SIM-004',severity:'LOW',title:'Repeated MFA denial prompts',asset:'lab-vpn-01',source:'192.0.2.70',time:'T+00:27',tactic:'Credential Access',summary:'A low-severity sample event records repeated denied second-factor prompts.',evidence:['MFA denials shown in an illustrative timeline','No account lockout or successful session is represented','User error and push fatigue are alternative explanations'],actions:['Confirm with the account owner through an approved channel.','Review whether a successful session followed the prompts.','Apply identity-protection controls if the account context warrants it.'],status:'New'},
    {id:'SIM-003',severity:'LOW',title:'Email authentication policy review',asset:'lab-mail-gw-01',source:'203.0.113.18',time:'T+00:22',tactic:'Initial Access',summary:'A synthetic email-domain check is flagged for policy review rather than as a confirmed attack.',evidence:['Illustrative SPF/DMARC-related signal','The record does not identify a real domain','Mail forwarding and alignment settings can affect results'],actions:['Review SPF, DKIM and DMARC alignment for the owned domain.','Check legitimate third-party senders before changing policy.','Monitor aggregate reports as part of normal email security operations.'],status:'New'},
    {id:'SIM-002',severity:'CRITICAL',title:'Unexpected service creation',asset:'lab-win-05',source:'192.0.2.77',time:'T+00:18',tactic:'Persistence',summary:'A simulated Windows event depicts a service being installed outside a stated maintenance window.',evidence:['Service creation is represented by a synthetic record','Binary path, signer and parent process are not included','A service change can be legitimate when properly approved'],actions:['Verify change management and inspect the service binary path.','Check signer, hash, parent process and account context.','Isolate only if corroborating evidence indicates active compromise.'],status:'New'},
    {id:'SIM-001',severity:'MEDIUM',title:'Authentication failure baseline drift',asset:'lab-srv-auth-03',source:'198.51.100.42',time:'T+00:12',tactic:'Credential Access',summary:'A low-volume increase in failed authentication differs from the fictional baseline.',evidence:['Small increase over the example baseline','No successful login or account impact is established','Could reflect a stale service credential or user typo'],actions:['Correlate with identity logs and recent credential rotation.','Check for a shared source affecting multiple accounts.','Tune alert thresholds only after reviewing normal activity.'],status:'New'}
  ];

  const replayPool = [
    {id:'SIM-REPLAY',severity:'HIGH',title:'Suspicious login sequence',asset:'lab-srv-auth-06',source:'203.0.113.99',time:'T+00:02',tactic:'Credential Access',summary:'A synthetic replay event illustrates a burst of failed logins followed by a successful session.',evidence:['Replay record only; not connected to a real host','Mixed login outcomes require timestamp correlation','Source address uses a documentation-only IP range'],actions:['Correlate authentication outcomes and session records.','Confirm user and device context before making a disposition.','Document any containment action in the real incident platform.'],status:'New'},
    {id:'SIM-REPLAY',severity:'MEDIUM',title:'Web request anomaly',asset:'lab-web-03',source:'198.51.100.121',time:'T+00:01',tactic:'Discovery',summary:'A second synthetic record demonstrates how an analyst can inspect an unusual request pattern.',evidence:['Illustrative URL and response-code pattern','No server-side execution or impact is implied','Application context is required for a meaningful verdict'],actions:['Review the request, route and response in application logs.','Check related requests from the same source.','Escalate only when evidence supports the hypothesis.'],status:'New'}
  ];

  let activeFilter='ALL';
  let selectedId=events[0].id;
  let replayCount=0;
  const statuses=new Map(events.map(event=>[event.id,event.status]));
  const search=document.getElementById('soc-search');
  const detail=document.getElementById('soc-detail-content');
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const severityOrder={CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3};
  const getStatus=event=>statuses.get(event.id)||event.status;

  function updateMetrics(){
    const count=severity=>events.filter(e=>e.severity===severity).length;
    document.getElementById('soc-metric-total').textContent=events.length;
    document.getElementById('soc-metric-critical').textContent=count('CRITICAL');
    document.getElementById('soc-metric-high').textContent=count('HIGH');
    document.getElementById('soc-count-all').textContent=events.length;
    ['CRITICAL','HIGH','MEDIUM','LOW'].forEach(severity=>{
      const id='soc-count-'+severity.toLowerCase();
      const node=document.getElementById(id);
      if(node) node.textContent=count(severity);
    });
  }

  function filteredEvents(){
    const term=(search.value||'').trim().toLowerCase();
    return events.filter(event=>{
      const severityOk=activeFilter==='ALL'||event.severity===activeFilter;
      const haystack=[event.id,event.title,event.asset,event.source,event.tactic,event.summary].join(' ').toLowerCase();
      return severityOk&&(!term||haystack.includes(term));
    }).sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]||b.id.localeCompare(a.id));
  }

  function renderList(){
    const visible=filteredEvents();
    list.innerHTML=visible.map(event=>{
      const selected=event.id===selectedId?' is-selected':'';
      return `<button type="button" class="soc-event-row${selected}" data-soc-id="${esc(event.id)}" aria-pressed="${event.id===selectedId?'true':'false'}">
        <span class="soc-event-main">
          <span class="soc-event-meta"><span class="soc-severity soc-severity--${event.severity.toLowerCase()}">${esc(event.severity)}</span><span class="soc-event-id">${esc(event.id)}</span></span>
          <strong>${esc(event.title)}</strong>
          <span class="soc-event-sub">${esc(event.tactic)} · ${esc(event.source)}</span>
        </span>
        <span class="soc-event-right"><strong>${esc(event.asset)}</strong><span>${esc(event.time)}</span><span class="soc-event-chevron">↗</span></span>
      </button>`;
    }).join('');
    document.getElementById('soc-result-count').textContent=`${visible.length} of ${events.length} alerts shown`;
    if(!visible.length){
      list.innerHTML='<div class="soc-empty soc-empty--list">No demo alerts match these filters. Try another severity or search term.</div>';
    }
    list.querySelectorAll('[data-soc-id]').forEach(button=>button.addEventListener('click',()=>{
      selectedId=button.getAttribute('data-soc-id');
      renderList();renderDetail();
    }));
  }

  function renderDetail(){
    const event=events.find(item=>item.id===selectedId);
    if(!event){
      document.getElementById('soc-detail-id').textContent='NO SELECTION';
      detail.innerHTML='<div class="soc-empty">Choose an alert from the queue.</div>';
      document.getElementById('soc-triage-btn').disabled=true;
      return;
    }
    document.getElementById('soc-detail-id').textContent=event.id;
    document.getElementById('soc-triage-btn').disabled=false;
    const status=getStatus(event);
    const next=status==='New'?'Mark investigating':status==='Investigating'?'Mark contained':'Re-open incident';
    detail.innerHTML=`<div class="soc-detail-title-row"><span class="soc-severity soc-severity--${event.severity.toLowerCase()}">${esc(event.severity)}</span><span class="soc-status-chip soc-status--${status.toLowerCase().replace(/\s+/g,'-')}">${esc(status.toUpperCase())}</span></div>
      <h4>${esc(event.title)}</h4>
      <p class="soc-detail-summary">${esc(event.summary)}</p>
      <div class="soc-detail-fields"><div><span>ASSET</span><strong>${esc(event.asset)}</strong></div><div><span>SOURCE IP (DEMO)</span><strong>${esc(event.source)}</strong></div><div><span>TACTIC</span><strong>${esc(event.tactic)}</strong></div><div><span>TIME</span><strong>${esc(event.time)}</strong></div></div>
      <div class="soc-detail-section"><span class="soc-section-kicker">OBSERVED INDICATORS</span><ul>${event.evidence.map(item=>`<li>${esc(item)}</li>`).join('')}</ul></div>
      <div class="soc-detail-section"><span class="soc-section-kicker">SUGGESTED TRIAGE</span><ol>${event.actions.map(item=>`<li>${esc(item)}</li>`).join('')}</ol></div>
      <div class="soc-detail-local-note"><span aria-hidden="true">ⓘ</span> Educational example only. No action is sent to a real endpoint or SIEM.</div>`;
    document.getElementById('soc-triage-btn').innerHTML=esc(next)+' <span aria-hidden="true">↗</span>';
    document.getElementById('soc-triage-note').textContent='Local demo state only — it is not written to a backend.';
  }

  document.querySelectorAll('[data-soc-filter]').forEach(button=>{
    button.addEventListener('click',()=>{
      activeFilter=button.dataset.socFilter;
      document.querySelectorAll('[data-soc-filter]').forEach(item=>{
        const active=item===button;
        item.classList.toggle('is-active',active);
        item.setAttribute('aria-pressed',String(active));
      });
      renderList();
    });
  });
  search.addEventListener('input',renderList);

  document.getElementById('soc-inject-demo').addEventListener('click',()=>{
    const template=replayPool[replayCount%replayPool.length];
    replayCount++;
    const event={...template,id:'SIM-'+String(13+replayCount).padStart(3,'0'),time:'T+00:0'+(replayCount%9+1),title:template.title+' (replay '+replayCount+')',status:'New'};
    events.unshift(event);statuses.set(event.id,'New');selectedId=event.id;activeFilter='ALL';search.value='';
    document.querySelectorAll('[data-soc-filter]').forEach(button=>{
      const active=button.dataset.socFilter==='ALL';
      button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));
    });
    updateMetrics();renderList();renderDetail();
  });

  document.getElementById('soc-triage-btn').addEventListener('click',()=>{
    const event=events.find(item=>item.id===selectedId);
    if(!event)return;
    const current=getStatus(event);
    statuses.set(event.id,current==='New'?'Investigating':current==='Investigating'?'Contained':'Investigating');
    renderList();renderDetail();
  });

  updateMetrics();renderList();renderDetail();
})();
