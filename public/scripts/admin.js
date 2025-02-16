var socket = io('/admin');

var enabled = false;

var logId = 0;

const commandHistory = [];
var historyId = -1;

const logsDiv = document.getElementById('logsDiv');
const logsTable = document.createElement('table');
logsDiv.appendChild(logsTable);
const logsBody = document.createElement('tbody');
logsTable.appendChild(logsBody);

function stringify(val, depth, replacer, space) {
    depth = isNaN(+depth) ? 1 : depth;
    function _build(key, val, depth, o, a) { // (JSON.stringify() has it's own rules, which we respect here by using it for property iteration)
        return !val || typeof val != 'object' ? val : (a=Array.isArray(val), JSON.stringify(val, function(k,v){ if (a || depth > 0) { if (replacer) v=replacer(k,v); if (!k) return (a=Array.isArray(v),val=v); !o && (o=a?[]:{}); o[k] = _build(k, v, a?depth:depth-1); } }), o||(a?[]:{}));
    }
    return JSON.stringify(_build('', val, depth), null, space);
}

function log(str,type){
	const isScrolledToBottom = logsDiv.scrollHeight - logsDiv.clientHeight <= logsDiv.scrollTop + 1;
	
	const row = document.createElement("tr");
	row.classList.add(type ? type : "defaultLog");
	const cellId = document.createElement("td");
	cellId.appendChild(document.createTextNode(type=="inputLog" ? ">>>" : `[${logId}]`));
	cellId.classList.add('logIdCell');
	row.appendChild(cellId);
	const cellContent = document.createElement("td");
	const lines = ((typeof str === 'string' || str instanceof String) ? str : stringify(str, 2, null, 1)).split('\n');
	
	lines.forEach((line)=>{
		const numIndent = line.length-line.trimStart().length;
		var container = cellContent;
		for(let i = 0 ; i < numIndent ; i++){
			const newContainer = document.createElement('span');
			newContainer.classList.add('pre');
			container.appendChild(newContainer);
			container = newContainer;
		}
		container.appendChild(document.createTextNode(line));
		cellContent.appendChild(document.createElement('br'));
	});
	row.appendChild(cellContent);
	
	cellContent.classList.add('logCell');
	
	logsBody.appendChild(row);
	if(type!="inputLog"){
		logId++;
	}
	
	if(isScrolledToBottom)
    logsDiv.scrollTop = logsDiv.scrollHeight - logsDiv.clientHeight;
};

const promptInput = document.getElementById("promptInput");
const promptButton = document.getElementById("promptButton");

function onSubmit(){
	if(!enabled){
		return
	}
	const command = promptInput.value;
	if(command.length<1){
		return;
	}
	if(commandHistory.length==0 || commandHistory[0]!=command){
		commandHistory.unshift(command);
	}
	log(command,"inputLog");
	promptInput.value = "";
	socket.emit('prompt',command,(output)=>{
		log(output.content,output.status ? "defaultLog" : "errorLog");
	});
}

promptButton.addEventListener('click',onSubmit);
document.addEventListener('keyup', (e) => {
	if (e.code === "Enter"){onSubmit();return;}
	if (e.code === "ArrowUp"){
			if(!enabled){
				return
			}
			if(historyId+1>=commandHistory.length){
				return;
			}
			historyId++;
			const command = commandHistory[historyId];
			promptInput.value = command;
			return;
		}
	if (e.code === "ArrowDown"){
			if(!enabled){
				return
			}
			if(historyId==-1){
				return;
			}
			historyId--;
			if(historyId==-1){
				promptInput.value = "";
				return
			}
			const command = commandHistory[historyId];
			promptInput.value = command;
		}
});

function enable(){
	promptButton.disabled=false;
	promptInput.disabled=false;
	enabled = true;
}

function disable(){
	promptButton.disabled=true;
	promptInput.disabled=true;
	enabled = false;
}

function initSocket(){
	socket.on("log", (str) => {log(str,"globalLog")});

	socket.on("connect", () => {
		log("Connected to server", "metaLog");
		enable();
	});

	socket.on("disconnect", () => {
		disable();
		log("Disconnected from server. Attempting to reconnect...", "metaLog");
	});
}
initSocket();