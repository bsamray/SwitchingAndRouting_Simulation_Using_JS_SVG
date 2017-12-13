var svgnamespace = "http://www.w3.org/2000/svg";				
var numOfNodes = 0;
var limitOfNodes = 10;
var radiusCirc = 20;
var fontSize = 5;
var availableNodeNames = [];
var usedNodeNames = [];
var disallowedRegion = radiusCirc * 4;
					
var adjNodeObj = {};
var chnlInitPos = [];
var chnlFinalPos = [];
					
var chnlClickFlg = false;
var intervals = {};
				
var rtg_mode = "SP";	//default value
var invalidFields = "";
				
var src = "A";	//default value
var dest = "B";	//default value
var manual_cost_flg = "M";	//default value
				
var anim_delay = 0;
var rand_ceiling = 20;

var chnl_delays = {};
var delayFactor = 2000;
var ping_dur = 2;
				
var nodes_visited = [];
var routing_intervals = {};
var path_node_cost = {};
var pathDiscovered = "";
var nodes_unsettled = {};				
				
/*DV-related - start */
				
var dv_vectors_A = {};
var dv_vectors_B = {};
var dv_vectors_C = {};
var dv_vectors_D = {};
var dv_vectors_E = {};
var dv_vectors_F = {};
var dv_vectors_G = {};
var dv_vectors_H = {};
var dv_vectors_I = {};
var dv_vectors_J = {};

var dv_vectors_A_previter = {};
var dv_vectors_B_previter = {};
var dv_vectors_C_previter = {};
var dv_vectors_D_previter = {};
var dv_vectors_E_previter = {};
var dv_vectors_F_previter = {};
var dv_vectors_G_previter = {};
var dv_vectors_H_previter = {};
var dv_vectors_I_previter = {};
var dv_vectors_J_previter = {};
				
var dv_node_anim_flags = {};
				
var iterCount = 0;
var final_path_cost = {};
var dest_cost_found_flag = false;				
/* DV-related - end */
var firstRunSincePgLoadFlg = true;
var inProgFlg = false;
var dv_inprog_nodes = [];
var dv_lastseq = -1;
var pauseFlg = false;
var pausedSetIntervalVal = -1;
var dv_tbls_mast_svg;



/**
 * Validates user input.
 * @returns {boolean} validFlag - The outcome of validation.
 */										
function validateInput(){
	var validFlag = true;						
	rtg_mode = document.getElementById("route_mode").value;
	if (!(rtg_mode == "DV" || rtg_mode == "SP")){
		validFlag = false; 
		invalidFields += " \nRouting Technique";
	}						
	src = document.getElementById("startNode").value;
	if (usedNodeNames.indexOf(src) < 0 || adjNodeObj[src].length == 0){
		validFlag = false; 
		invalidFields += " \nStart Node";
	}
	dest = document.getElementById("endNode").value;
	if (usedNodeNames.indexOf(dest) < 0 || adjNodeObj[dest].length == 0){
		validFlag = false; 
		invalidFields += " \nEnd Node";
	}	
	manual_cost_flg = document.getElementById("route_manual_cost").value;
	var usr_link_costs = document.getElementById("link_costs").value.toUpperCase();
	if (manual_cost_flg == "0"){
		validFlag = false; 
		invalidFields += " \nLink Cost Entry Mode";
	} else if (manual_cost_flg == "M"){
		if (usr_link_costs == null || usr_link_costs.length == 0 || usr_link_costs.split("=").length == 1) {
			validFlag = false;
			invalidFields += " \nLink Costs - Invalid format";
		} else {				
			var usr_link_costs_list = usr_link_costs.split(",");				
			for (var j=0; j<usr_link_costs_list.length; j++){
				var link_frm_to = usr_link_costs_list[j].split("=")[0];
				var link_cost = usr_link_costs_list[j].split("=")[1];
				var corr_chnl_elem = determineReqChnlDet(link_frm_to).elem;		
				//referred to mohagali - https://stackoverflow.com/questions/23476532/check-if-string-contains-only-letters-in-javascript
				if (  corr_chnl_elem == null || isNaN(link_cost) || link_cost <= 0 || link_cost > 20 || !(/^[A-Z][A-Z]$/.test(link_frm_to))  ){
					validFlag = false;
					invalidFields += " \nLink Costs - Invalid format";
				} else {
					var corr_chnl_id = determineReqChnlDet(link_frm_to).id;
					chnl_delays[corr_chnl_id] = Number(link_cost);
				}											
			}				
			for (var k = 0; k < Object.keys(chnl_delays).length; k++){
				var key = Object.keys(chnl_delays)[k];
				if (chnl_delays[key] == 0){
					//alert(key);
					validFlag = false;
					invalidFields += " \nMissing Link Cost: " + key.split("_")[1] + key.split("_")[2];
				}
			}		
		}				
	}	
	invalidFields = invalidFields.length > 0 ? invalidFields.substring(1, invalidFields.length) : "";					
	return validFlag;
}
					

					
/**
 * Captures user button click and routes to appropriate routing functon.
 */				
function startAnim(){	
	if(!inProgFlg){
		if(!firstRunSincePgLoadFlg){	
			reset();
		}					
		if(!validateInput()){
			alert("Invalid input:" + invalidFields);
			invalidFields = "";
		} else {
			inProgFlg = true;
			final_path_cost[src + "_" + dest] = dest + ",";
			makeOutputAreaVisible();
			backupForFutureRetry();						
			if (rtg_mode == "SP"){
				initShortestPathRtg();
			} else if (rtg_mode == "DV"){			
				measureLineDelays();							
				initDisVectRtg();
			}
		}
	} else {
		alert("Please wait for current simulation to complete.\nElse please refresh page and start over");
	}	
}	



/**
 * Keeps a copy of initial tables for use in case of retry.
 */
function backupForFutureRetry(){
	dv_tbls_mast_svg = document.getElementById("dv_table_svg").cloneNode(true);
}
			


/**
 * Resets the variables and animations for retry.
 */	
function reset(){
	nodes_visited = [];
	path_node_cost = {};
	pathDiscovered = "";
	nodes_unsettled = {};
	final_path_cost = {};
	dest_cost_found_flag = false;
	iterCount = 0;
	
	for (var k = 0; k < Object.keys(intervals).length; k++){
		clearInterval(intervals[ Object.keys(intervals)[k] ]);
	}
	for (var j = 0; j < Object.keys(routing_intervals).length; j++){
		clearInterval(routing_intervals[ Object.keys(routing_intervals)[j] ]);
	}
	var txtelem_line0 = document.getElementById("desc_line_0");
	txtelem_line0.textContent = "";
	txtelem_line0.setAttribute("style", "stroke:none");		
	var txtelems = document.getElementsByClassName("desc_line");
	for (var l=0; l<txtelems.length; l++){
		var txtelem = txtelems[l];
		if (txtelem.getAttribute("id") != "desc_line_9"){
			txtelem.textContent = "";
			txtelem.setAttribute("style", "stroke:none");
		} else {
			txtelem.setAttribute("fill-opacity", "0");
			txtelem.setAttribute("style", "fill: #000000; stroke: none; font-size: 16px;");
		}
	}
	var nodes = document.getElementsByClassName("node_type");
	for (var m=0; m<nodes.length; m++){
		nodes[m].setAttribute("fill", "grey");
	}		
	var chnls = document.getElementsByClassName("chnl_type");
	for (var n=0; n<chnls.length; n++){
		chnls[n].setAttribute("style", "stroke:#000000;stroke-width:2");
	}		
	var node_cost_texts = document.getElementsByClassName("node_cost_text");
	for (var p=0; p<node_cost_texts.length; p++){
		var node_cost_text = node_cost_texts[p];
		node_cost_text.textContent = "";
		node_cost_text.setAttribute("style", "stroke:none");
	}
	var ping_anims = document.getElementsByClassName("pingconnsig");
	while(ping_anims[0]) {
		ping_anims[0].parentNode.removeChild(ping_anims[0]);
	}
	var chnlcost_texts = document.getElementsByClassName("chnlcost");
	while(chnlcost_texts[0]) {
		chnlcost_texts[0].parentNode.removeChild(chnlcost_texts[0]);
	}
	
	/* dv specific */
	dv_inprog_nodes = [];
	dv_lastseq = -1;
	
	removeFillDVNodes();
	
	var dv_table_svg_elem = document.getElementById("dv_table_svg");
	dv_table_svg_elem.parentNode.removeChild(dv_table_svg_elem);
	document.getElementById("master_svg").appendChild (dv_tbls_mast_svg); 
	
	dv_vectors_A = {};
	dv_vectors_B = {};
	dv_vectors_C = {};
	dv_vectors_D = {};
	dv_vectors_E = {};
	dv_vectors_F = {};
	dv_vectors_G = {};
	dv_vectors_H = {};
	dv_vectors_I = {};
	dv_vectors_J = {};

	dv_vectors_A_previter = {};
	dv_vectors_B_previter = {};
	dv_vectors_C_previter = {};
	dv_vectors_D_previter = {};
	dv_vectors_E_previter = {};
	dv_vectors_F_previter = {};
	dv_vectors_G_previter = {};
	dv_vectors_H_previter = {};
	dv_vectors_I_previter = {};
	dv_vectors_J_previter = {};
	
}



/**
 * Activates user input text fields as per selected cost entry option.
 * @param {string} link_cost_entry_mode - Represents the choice of manual or random cost entry.
 */
/* onchange method of select working is referred from http://jsfiddle.net/mplungjan/eqffs/ */
function activateInputFields(field){
	/* link cost entry mode */
	if (field.getAttribute("id") == "route_manual_cost"){
		if (field.value == "M"){
			document.getElementById("link_costs_label").setAttribute("class", "label");
			document.getElementById("link_costs").removeAttribute("disabled");
		} else {		
			document.getElementById("link_costs_label").setAttribute("class", "label_inactive_init");
			document.getElementById("link_costs").setAttribute("disabled", "disabled");
		}
	}
	
	if (field.getAttribute("id") == "route_mode"){
		if(field.value == "DV"){
			document.getElementById("pause_resume_rect").setAttribute("style", "stroke:#000000;");
			document.getElementById("pause_resume").setAttribute("style", "stroke: #000000; fill: #ffffff");
			document.getElementById("pause_resume_label").setAttribute("style", "fill: #000000; stroke: none; font-size: 13px;");
		} else {
			document.getElementById("pause_resume_rect").setAttribute("style", "stroke:#ffffff;");
			document.getElementById("pause_resume").setAttribute("style", "stroke: #ffffff; fill: #ffffff");
			document.getElementById("pause_resume_label").setAttribute("style", "fill: #ffffff; stroke: none; font-size: 13px;");			
		}
	}
}



/**
 * Initiates distance vector routing simulation.
 */			
function initDisVectRtg(){
	if (iterCount == 0){
		intervals["dv_route_found"] = eval(setInterval(function() { checkDVRouteFound(src,dest)  }, 20));
	}					
	for(var i=0; i<usedNodeNames.length; i++){
		dv_node_anim_flags["start_anim_flag_" + usedNodeNames[i]] = false;
		setNodeItervalForAnim(usedNodeNames[i], i); 
		var tbl_entry_arr = [usedNodeNames[i], 0, usedNodeNames[i]];
						
		var dv_req_tbl = determineVectorTable(usedNodeNames[i], 0); //mode 0 means init state, mode 1 means normal update	; references the node-specific variable
		dv_req_tbl["to_" + usedNodeNames[i]] = tbl_entry_arr.slice();							
	}	
	setPrevIterDVTables();				
	dv_node_anim_flags["start_anim_flag_" + usedNodeNames[0]] = true;
	populateTextOutput("desc_line_0", "Iteration 1 to begin ..");				
	iterCount++;
	
}



/**
 * Keeps a copy of end-of-iteration tables for use in next iteration.
 */	
function setPrevIterDVTables(){	
	dv_vectors_A_previter = cloneObj(dv_vectors_A);
	dv_vectors_B_previter = cloneObj(dv_vectors_B);
	dv_vectors_C_previter = cloneObj(dv_vectors_C);
	dv_vectors_D_previter = cloneObj(dv_vectors_D);
	dv_vectors_E_previter = cloneObj(dv_vectors_E);
	dv_vectors_F_previter = cloneObj(dv_vectors_F);
	dv_vectors_G_previter = cloneObj(dv_vectors_G);
	dv_vectors_H_previter = cloneObj(dv_vectors_H);
	dv_vectors_I_previter = cloneObj(dv_vectors_I);
	dv_vectors_J_previter = cloneObj(dv_vectors_J);	
}



/**
 * Clones an object without any reference to the original object.
 * @param {object} source - The object which is to be cloned.
 */	
/* adapted from credited code snippet by Denys Seguret - https://stackoverflow.com/questions/12690107/clone-object-without-reference-javascript */
function cloneObj(source) {
	
    if (Object.prototype.toString.call(source) === '[object Array]') {
        var clone = [];
        for (var i=0; i<source.length; i++) {
            clone[i] = cloneObj(source[i]);
        }
        return clone;
    } else if (typeof(source)=="object") {
        var clone = {};
        for (var prop in source) {
            if (source.hasOwnProperty(prop) && typeof(prop) == "string" && !prop.startsWith("new_to_")) {
                clone[prop] = cloneObj(source[prop]);
            }
        }
        return clone;
    } else {
        return source;
    }
}


					
/**
 * Starts DV routing animation for a particular node.
 * @param {string} node - The label of the node.
 * @param {string} node_pos - The sequence of this node in the list of drawn nodes.
 */				
function beginDVAnimationForNode(node, node_pos){
	var node_comp_entries = {};
	for (var i = 0; i < adjNodeObj[node].length; i++){
		var adjnode_tbl = determineVectorTable(adjNodeObj[node][i], 1);												
		for (var j = 0; j < Object.keys(adjnode_tbl).length; j++){							
			var key = Object.keys(adjnode_tbl)[j];
			//alert( node + " " + key.substring(key.length-1, key.length) + (node==key.substring(key.length-1, key.length)));

			/* check if node to which distance is measured is not self */
			if (node!=key.substring(key.length-1, key.length)){
				//alert("in " + key  + " " +node);
				var node_comp_entry = adjNodeObj[node][i] + "_" + key;							
				var dist_to_node = adjnode_tbl[key];			
				//alert(key + " " + node_comp_entry + " " + dist_to_node);										
				node_comp_entries[node_comp_entry] = dist_to_node[1];	
			}						
						
		}							
	}	
	
				
	var dv_vectors_preiter_tbl = determineVectorTable(node, 0);				
	for(var n = 0; n < Object.keys(node_comp_entries).length; n++){
		var cur_key_adj_entries = Object.keys(node_comp_entries)[n];
		var key_tobe_searched = cur_key_adj_entries.substring(2,cur_key_adj_entries.length);
		var to_node = cur_key_adj_entries.substring(cur_key_adj_entries.length - 1,cur_key_adj_entries.length);
		var key_owner = cur_key_adj_entries.substring(0,1);
		var chnlcost_node_to_keyowner  = Number( chnl_delays[determineReqChnlDet(node + key_owner).id] );
		var cost_to_cmp = node_comp_entries[cur_key_adj_entries] + chnlcost_node_to_keyowner;
		var cost_node_cur = 0;
		if(typeof dv_vectors_preiter_tbl[key_tobe_searched] == 'undefined'){							
			if (typeof dv_vectors_preiter_tbl["new_to_" + to_node] != 'undefined' && dv_vectors_preiter_tbl["new_to_" + to_node].length > 0 ){
				cost_node_cur = dv_vectors_preiter_tbl["new_to_" + to_node][1];
			} else {
				cost_node_cur =  1000;
			}							
		}												
		var finalOfNodeFlag = n == Object.keys(node_comp_entries).length - 1 ? true : false;	
							
		sendForOutput(node, node_pos, to_node, cost_node_cur, key_owner, chnlcost_node_to_keyowner, node_comp_entries[cur_key_adj_entries], finalOfNodeFlag, n);
		if (  (typeof cost_node_cur == 'undefined') ||  (cost_node_cur > cost_to_cmp) ){			
			dv_vectors_preiter_tbl["new_to_" + to_node] = [to_node, cost_to_cmp, key_owner];			
		}						
	}	
	
	
					
}
				


/**
 * Routing function for printing status to page output area.
 * @param {string} node - The label of the node.
 * @param {number} seq - The sequence of this node in the list of drawn nodes.
 * @param {string} to_node - Node being compared.
 * @param {string} cost_node_cur - Current cost at compared node.
 * @param {string} key_owner - The node corresponding to table entry.
 * @param {string} chnl_cost - The cost of connecting link.
 * @param {string} to_node_cost - New candidate cost.
 * @param {string} finalFlag - The flag to indicate final entry of a node vector table. 
 * @param {number} tblentries_thisid - The sequence of current table entry in node_comp_entries[node] array. 
 */				
function sendForOutput(node, seq, to_node, cost_node_cur, key_owner, chnl_cost, to_node_cost, finalFlag, tblentries_thisid){
	setTimeout(function(){ printOutput(node, seq, to_node, cost_node_cur, key_owner, chnl_cost, to_node_cost, finalFlag) }, (tblentries_thisid+1)*6000); //assumed delay of anim
}
				


/**
 * Printing status to page output area.
 * @param {string} node - The label of the node.
 * @param {number} seq - The sequence of this node in the list of drawn nodes.
 * @param {string} to_node - Node being compared.
 * @param {string} cost_node_cur - Current cost at compared node.
 * @param {string} key_owner - The node corresponding to table entry.
 * @param {string} chnl_cost - The cost of connecting link.
 * @param {string} to_node_cost - New candidate cost.
 * @param {string} finalentryOfNodeFlag - The flag to indicate final entry of a node vector table. 
 * @param {number} tblentries_thisid - The sequence of current table entry in node_comp_entries[node] array. 
 */				
function printOutput(node, seq, to_node, cost_node_cur, key_owner, chnl_cost, to_node_cost, finalentryOfNodeFlag){
	removeFillDVNodes();
	fillDVNodes(node, key_owner, to_node);	
	dv_inprog_nodes.push(node, key_owner, to_node);
	populateTextOutput("desc_line_0", "Ongoing " + node + " in iteration " + iterCount + " ..");	
	var output_txtelem_1 = document.getElementById("desc_line_1");
	var output_txtelem_2 = document.getElementById("desc_line_2");
	var output_txtelem_3 = document.getElementById("desc_line_3");
	var output_txtelem_4 = document.getElementById("desc_line_4");
	var output_txtelem_5 = document.getElementById("desc_line_5");
	var output_txtelem_6 = document.getElementById("desc_line_6");
	var output_txtelem_7 = document.getElementById("desc_line_7");
	var output_txtelem_8 = document.getElementById("desc_line_8");					
	output_txtelem_1.textContent = "Iteration count: " + iterCount;
	output_txtelem_2.textContent = "Vector update in progress of: " + node;					
	output_txtelem_3.textContent = "To Node: " + to_node;
	output_txtelem_4.textContent = "Via: " + key_owner;
	if (cost_node_cur == 1000){
		output_txtelem_5.textContent = "Current cost: Infinite (unknown)";
	} else {
		output_txtelem_5.textContent = "Current cost: " + cost_node_cur;
	}
						
	output_txtelem_6.textContent = "Candidate cost: " + to_node_cost;
	output_txtelem_7.textContent = "Channel cost: " + chnl_cost;
	if (cost_node_cur > chnl_cost + to_node_cost){
		output_txtelem_8.textContent = "New cost updated: Yes";
	} else {
		output_txtelem_8.textContent = "New cost updated: No";
	}					
	output_txtelem_1.setAttribute("fill-opacity", "1");
	output_txtelem_2.setAttribute("fill-opacity", "1");
	output_txtelem_3.setAttribute("fill-opacity", "1");
	output_txtelem_4.setAttribute("fill-opacity", "1");
	output_txtelem_5.setAttribute("fill-opacity", "1");
	output_txtelem_6.setAttribute("fill-opacity", "1");
	output_txtelem_7.setAttribute("fill-opacity", "1");
	output_txtelem_8.setAttribute("fill-opacity", "1");
	
														
	if(finalentryOfNodeFlag){
		updateNodeVectorTable(node);						
		if(!isLastAvailableNodeForIter(node)){
			setTimeout(function(){setFlagForInitNextNode(usedNodeNames[seq+1]) }, 5000);
			//dv_node_anim_flags["start_anim_flag_" + usedNodeNames[seq+1]] = true;
		} else if (!dest_cost_found_flag){	//last node for iteration			
			setTimeout(initNextIteration(), 5000);
			populateTextOutput("desc_line_0", "Preparing next iteration ..");			
		} 
		
	}					
}
				


/**
 * Fills nodes involved in current animation.
 * @param {string} node - The label of reference (from) node .
 * @param {string} key_owner - The label of via (neighbour) node.
 * @param {string} to_node - The label of target (to) node.
 */
function fillDVNodes(node, key_owner, to_node){
	var node_elem = document.getElementById("node_" + node);						
	node_elem.setAttribute("fill", "#E9C4D6");
	document.getElementById("node_legend").setAttribute("fill", "#E9C4D6");
	
	var keyowner_elem = document.getElementById("node_" + key_owner);						
	keyowner_elem.setAttribute("fill", "#FFC300");
	document.getElementById("vianeighbour_legend").setAttribute("fill", "#FFC300");
	
	var tonode_elem = document.getElementById("node_" + to_node);		
	if(to_node == key_owner){
		//alert("if " + node + " " + key_owner + " " + to_node);
		tonode_elem.setAttribute("fill", "#FFC300");
		document.getElementById("tonode_legend").setAttribute("fill", "#FFC300");
	} else {							
		//alert("else " + node + " " + key_owner + " " + to_node);
		tonode_elem.setAttribute("fill", "#DAF7A6");
		document.getElementById("tonode_legend").setAttribute("fill", "#DAF7A6");
	}

}



/**
 * Removes fill of nodes involved in previous gone by animation.
 */
function removeFillDVNodes(){
	for(var i=0; i<dv_inprog_nodes.length; i++){
		var node_elem = document.getElementById("node_" + dv_inprog_nodes[i]);						
		node_elem.setAttribute("fill", "grey");
	}
	dv_inprog_nodes = [];
	document.getElementById("node_legend").setAttribute("fill", "#ffffff");
	document.getElementById("tonode_legend").setAttribute("fill", "#ffffff");
	document.getElementById("vianeighbour_legend").setAttribute("fill", "#ffffff");
}



/**
 * Updated the pause status during animation.
 */
function flipPauseResumeStatus(){
	if(inProgFlg){
		var pause_resume_labeltxt = document.getElementById("pause_resume_label");
		if(pauseFlg){
			pauseFlg = false;
			pause_resume_labeltxt.textContent = "PAUSE";
		} else {
			pauseFlg = true;
			pause_resume_labeltxt.textContent = "START";
		}
	}
}



/**
 * Updated the flag for starting animation for next node.
 * @param {string} node - The label of the corresponding next node.
 */	
function setFlagForInitNextNode(node){
	if(!pauseFlg){
		removeFillDVNodes();
		removeAllTextOutput();
		removeTextOutput("desc_line_0");
		dv_node_anim_flags["start_anim_flag_" + node] = true;	
		if (pausedSetIntervalVal > -1){
			clearInterval(pausedSetIntervalVal);
		}
	}
	else {
		if (pausedSetIntervalVal == -1){
			pausedSetIntervalVal = setInterval(function() { setFlagForInitNextNode(node)  }, 1000);
		}
	}	
}


				
/**
 * Updated the vector tables of the node in the programming constructs.
 * @param {string} node - The label of the node.
 */				
function updateNodeVectorTable(node){
	if(dest_cost_found_flag){
		populateTextOutput("desc_line_0", "Final iteration in progress..");
	} else {
		populateTextOutput("desc_line_0", "Assessing tables received at " + node  + "..");
	}
	
	var dv_vectors_postiter_tbl = determineVectorTable(node, 0);
	for (var i = 0; i < Object.keys(dv_vectors_postiter_tbl).length; i++){
		var cur_key = Object.keys(dv_vectors_postiter_tbl)[i];
		var to_node = cur_key.substring(cur_key.length - 1, cur_key.length);
		if (cur_key.startsWith("new_to_")){
			dv_vectors_postiter_tbl["to_" + to_node] = dv_vectors_postiter_tbl[cur_key].slice();							
			for ( var j = 1; j <= 10; j++ ){ //number of text elems max 10
				var cur_txt_elem = document.getElementById("Iter" + iterCount + "_" + node + "_vect_row_txt_" + j);
				if ( cur_txt_elem != null && to_node == cur_txt_elem.textContent.substring(0,1) && to_node != node ){
					cur_txt_elem.textContent = dv_vectors_postiter_tbl["to_" + to_node].toString();
				}
			}						
							
		}
	}	
}


				
/**
 * Prints to user and intiates next iteration of vector exchanges.
 */					
function initNextIteration(){
	removeFillDVNodes();
	removeAllTextOutput();
	removeTextOutput("desc_line_0");
	populateTextOutput("desc_line_0", "Starting next iteration ..");
	iterCount++;
	setPrevIterDVTables();
	dv_node_anim_flags["start_anim_flag_" + usedNodeNames[0]] = true;	
	showNextIterTables();					
}



/**
 * Clones latest iteration tables to represent new iteration.
 */
function showNextIterTables(){
	var container = document.getElementById('dv_table_svg');
	var prev_iter_svg_tbl_ypos = document.getElementById("Iter" + Number(iterCount-1) + "_table").getAttribute("y");
	var new_iter_svg_tbl_ypos = "" + (Number(prev_iter_svg_tbl_ypos) + 25*(usedNodeNames.length+1));
	var svg_tbl_clone = document.getElementById("Iter" + Number(iterCount-1) + "_table").cloneNode(true);
	svg_tbl_clone.setAttribute("id", "Iter" + iterCount + "_table");
	svg_tbl_clone.setAttribute("x", "0");
	svg_tbl_clone.setAttribute("y", new_iter_svg_tbl_ypos);
	container.appendChild (svg_tbl_clone);  
	var rects = svg_tbl_clone.getElementsByClassName("vect_row_rect");
	for(var i=0; i<rects.length; i++){
		var rect_id_cur = rects[i].getAttribute("id");
		var rect_id_new = rect_id_cur.replace("Iter" + Number(iterCount-1), "Iter" + iterCount);
		rects[i].setAttribute("id", rect_id_new);
	}
	var txts = svg_tbl_clone.getElementsByClassName("vect_row_txt");
	for(var i=0; i<txts.length; i++){
		var txt_id_cur = txts[i].getAttribute("id");
		var txt_id_new = txt_id_cur.replace("Iter" + Number(iterCount-1), "Iter" + iterCount);
		txts[i].setAttribute("id", txt_id_new);
	}
	var tbls = svg_tbl_clone.getElementsByClassName("vect_tbl_nodeid");
	for(var i=0; i<tbls.length; i++){
		var tbl_id_cur = tbls[i].getAttribute("id");
		var tbl_id_new = tbl_id_cur.replace("Iter" + Number(iterCount-1), "Iter" + iterCount);
		tbls[i].setAttribute("id", tbl_id_new);
	}
}


				
/**
 * Determines if the node is the last node for the iteration.
 * @param {string} node - The label of the node.
 */					
function isLastAvailableNodeForIter(node){
	return (usedNodeNames.indexOf(node) == usedNodeNames.length - 1);
}



/**
 * Determines the vector table corresponding to node.
 * @param {string} node - The label of the node.
 * @param {string} initFlag - The flag that determines the logic.
 */				
function determineVectorTable(node, initFlag){
	var dv_req_tbl = {};
	switch (node) {
	case "A":
		initFlag == 0 ? eval(dv_req_tbl = dv_vectors_A) : eval(dv_req_tbl = dv_vectors_A_previter);//can then manipulate local dv_req_tbl as object assignment is by reference and not by value
		break;						
	case "B":
		initFlag == 0 ? eval(dv_req_tbl = dv_vectors_B) : eval(dv_req_tbl = dv_vectors_B_previter);	
		break;						
	case "C":
		initFlag == 0 ? eval(dv_req_tbl = dv_vectors_C) : eval(dv_req_tbl = dv_vectors_C_previter);
		break;							
	case "D":
		initFlag == 0 ? eval(dv_req_tbl = dv_vectors_D) : eval(dv_req_tbl = dv_vectors_D_previter);	
		break;						
	case "E":
		initFlag == 0 ? eval(dv_req_tbl = dv_vectors_E) : eval(dv_req_tbl = dv_vectors_E_previter);	
		break;							
	case "F":
		initFlag == 0 ? eval(dv_req_tbl = dv_vectors_F) : eval(dv_req_tbl = dv_vectors_F_previter);	
		break;						
	case "G":
		initFlag == 0 ? eval(dv_req_tbl = dv_vectors_G) : eval(dv_req_tbl = dv_vectors_G_previter);
		break;							
	case "H":
		initFlag == 0 ? eval(dv_req_tbl = dv_vectors_H) : eval(dv_req_tbl = dv_vectors_H_previter);	
		break;						
	case "I":
		initFlag == 0 ? eval(dv_req_tbl = dv_vectors_I) : eval(dv_req_tbl = dv_vectors_I_previter);	
		break;								
	case "J":
		initFlag == 0 ? eval(dv_req_tbl = dv_vectors_J) : eval(dv_req_tbl = dv_vectors_J_previter);	
	}					
	return dv_req_tbl;
}


				
/**
 * Introduces a delay before a node animation starts.
 * @param {string} node - The label of the node.
 * @param {string} pos - The sequence of node in the node list.
 */			
function setNodeItervalForAnim(node, pos){
	intervals["dv_node_anim" + node] = eval(setInterval(function() { checkToInitNodeAnim(node, pos)  }, 5000)); //5000 ASSUMED VALUE
}
				
				

/**
 * Starts node animation.
 * @param {string} node - The label of the node.
 * @param {string} pos - The sequence of node in the node list.
 */
function checkToInitNodeAnim(node, pos){
	if (dv_node_anim_flags["start_anim_flag_" + node] == true){
		dv_node_anim_flags["start_anim_flag_" + node] = false;
		beginDVAnimationForNode (node, pos);						
	}	
}


				
/**
 * Assesses the current state if required route has been found and outputs if so.
 */			
function checkDVRouteFound(){
	/*referred from https://www.w3schools.com/jsref/jsref_charcodeat.asp */
	var char_code_dest = dest.charCodeAt(0);
	var req_rt_elem = document.getElementById("Iter" + iterCount + "_" + src + "_vect_row_txt_" + (char_code_dest - 64));
	if (  req_rt_elem.textContent != final_path_cost[src + "_" + dest]  ){
		final_path_cost[src + "_" + dest] = req_rt_elem.textContent;
		req_rt_elem.setAttribute("style", "stroke:green");
		//populateTextOutput("desc_line_0", "Route found: " + req_rt_elem.textContent);			
		dest_cost_found_flag = true;
		//removeAllTextOutput();
		/*to be commented when repeated terations are required in case of future improvements for adaptive routing simulation */
		clearInterval(intervals["dv_route_found"]);
		document.getElementById("desc_line_9").setAttribute("fill-opacity", "1");
		document.getElementById("desc_line_9").setAttribute("style", "fill: #000000; stroke: green; font-size: 16px;");
		resetFlags(); //commented25aug,uncommented26aug
		
	}
}


				
/**
 * Shows output area and calls function to show first iteration tables (DV).
 */					
function makeOutputAreaVisible(){
	document.getElementById("stats_boundary").setAttribute("style", "stroke:#000000;");
	document.getElementById("desc_line_0").setAttribute("fill-opacity", "1");					
	if (rtg_mode == "DV"){						
		makeVectorTablesVisible();
		document.getElementById("desc_tbl_entry").setAttribute("fill-opacity", "1");									
	}										
}


			
/**
 * Makes the first iteration tables visible.
 */			
function makeVectorTablesVisible(){				
	var vect_tbl_hdr_list = document.getElementsByClassName("vect_tbl_nodeid");					
	for (var i=0; i<vect_tbl_hdr_list.length; i++){												
		var elem1 = vect_tbl_hdr_list[i];
		var id_elem1 = elem1.getAttribute("id");
		if (usedNodeNames.indexOf(id_elem1.substring(6,7)) < 0){
			elem1.parentNode.removeChild(elem1);
		} else {
			elem1.setAttribute("fill-opacity","1");
		}		
	}										
	

	var vect_row_rect_list = document.getElementsByClassName("vect_row_rect");					
	//alert(vect_row_rect_list.length);
	for (var j=0; j<vect_row_rect_list.length; j++){							
		var elem2 = vect_row_rect_list[j];
		var id_elem2 = elem2.getAttribute("id");
		//alert(j + " " + id_elem2 + " " + elem2.parentNode.getAttribute("id"));
		//document.removeChild(document.getElementById(id_elem2));
		//elem2.parentNode.removeChild(elem2);
		if (! (usedNodeNames.indexOf(id_elem2.substring(6,7)) < 0  ||  (usedNodeNames.length < Number(id_elem2.split("_")[4])))  ){			
			//elem2.setAttribute("style","stroke:#ffffff; fill: #ffffff");
			elem2.setAttribute("style","stroke:#000000; fill: #ffffff");
		} 
	}
	var vect_row_txt_list = document.getElementsByClassName("vect_row_txt");
	for (var k=0; k<vect_row_txt_list.length; k++){
		var elem3 = vect_row_txt_list[k];
		var id_elem3 = elem3.getAttribute("id");			
		if(! (usedNodeNames.indexOf(id_elem3.substring(6,7)) < 0  ||  (usedNodeNames.length < Number(id_elem3.split("_")[5]) ) ) ){
			//elem3.parentNode.removeChild(elem3);
			//elem3.setAttribute("fill-opacity","0");
			elem3.setAttribute("fill-opacity","1");
		}					
	}
}
				


/* functions for shortest path routing below */



/**
 * Calls ping function for line delays and initiates the Shortest Path algorithm.
 */
function initShortestPathRtg(){
	for (var i = 0; i < Object.keys(adjNodeObj).length; i++){
		simulateEchoPkt(Object.keys(adjNodeObj)[i]);
	}
	setTimeout(function(){measureLineDelays()}, ping_dur*1000);	//TEST values assumed					
	//initialise to src node
	path_node_cost[src + dest + "_" + src + "_cost"] = 0;
	path_node_cost[src + dest + "_" + src + "_via"] = src;
	path_node_cost[src + dest + "_" + src + "_settledflag"] = false;
	setTimeout(function(){ populateTextOutput("desc_line_1", "Beginning algorithm at " + src + " .."); }, ping_dur*1.01*1000 + delayFactor);
	setTimeout(function(){callTraverseNetwork(findMinCostUnsettledNode()) }, ping_dur*1.01*1000 + delayFactor);	
}
				
				

/**
 * Fills the node and associated cost with respective colours
 * @param {string} node - The label of the node.
 * @param {string} cost - The cost to reach this node.
 * @param {string} via - The predecessor to this node in the path.
 * @param {string} via - The indicator that marks settled or unsettled. 
 */					
function markNodeAsVisited(node, cost, via, type){
	//type 0 stands for permanent, 1 stands for temporary
	pathDiscovered += node;
	var text_elem = document.getElementById("node_cost_text_" + node);						
	if(type == 0){
		text_elem.setAttribute("style", "stroke:green");
	} else if(type == 1){
		text_elem.setAttribute("style", "stroke:orange");
	}
	text_elem.textContent = "(" + cost + "," + via + ")";						
	var node_elem = document.getElementById("node_" + node);						
	if(type == 0){
		node_elem.setAttribute("fill", "green");
	} else if(type == 1){
		node_elem.setAttribute("fill", "orange");
	}											
}
								


/**
 * Calls the network traversal function.
 * @param {string} node - The label of the node.
 */
function callTraverseNetwork(node){
	setTimeout(function(){traverseNetwork(node) }, 3*delayFactor);
}	



/**
 * Recursive function that traverses the  network comparing costs of nodes.
 * @param {string} startNode - The label of the node.
 */				
function traverseNetwork(startNode){		
	nodes_visited.push(startNode);
	path_node_cost[src + dest + "_" + startNode + "_settledflag"] = true;
	var selected_chnl = determineReqChnlDet(startNode + path_node_cost[src + dest + "_" + startNode + "_via"]).id;
	callMarkSelected(startNode, selected_chnl, path_node_cost[src + dest + "_" + startNode + "_cost"], path_node_cost[src + dest + "_" + startNode + "_via"]);
	if(startNode != dest){						
		for (var i = 0; i < adjNodeObj[startNode].length; i++){
			var candidate_node = adjNodeObj[startNode][i];
			if( !hasBeenVisited(candidate_node) ){									   
				var related_chnl = determineReqChnlDet(startNode + candidate_node).id;						
				var existing_cost = typeof path_node_cost[src + dest + "_" + candidate_node + "_cost"] == "number" ? path_node_cost[src + dest + "_" + candidate_node + "_cost"] : 1000; //for  initial infinite cost
				var existing_via = path_node_cost[src + dest + "_" + candidate_node + "_via"];
				var startNode_cost = Number(path_node_cost[src + dest + "_" + startNode + "_cost"]);
				path_node_cost[src + dest + "_" + candidate_node + "_settledflag"] = false;
				var chnl_cost = 	Number(chnl_delays[related_chnl]);							
				callShowUnderAssessment(startNode, related_chnl, Number(i+1), candidate_node, startNode_cost + chnl_cost, 1);								
				var prcd_flag = false;
				var ex_cost_higher_flag = existing_cost > (startNode_cost + chnl_cost);
				var ex_cost_1000_flag = existing_cost == 1000;
				var cand_child_cnt_gt1_flag = adjNodeObj[candidate_node].length > 1;
				var cand_is_dest_flag = candidate_node == dest;								
				if( ex_cost_higher_flag || ex_cost_1000_flag ){
					prcd_flag = true;
					path_node_cost[src + dest + "_" + candidate_node + "_cost"] = Number(startNode_cost) + Number(chnl_cost);
					path_node_cost[src + dest + "_" + candidate_node + "_via"] = startNode;
				}											
			}
		}		
		setTimeout(function(){ callTraverseNetwork(findMinCostUnsettledNode()); }, 5*delayFactor);		
	}		
}



/**
 * Determines the least cost settled node at the time.
 * @returns {string} min_cost_unsettled_node - The label of least cost unsettled node.
 */
function findMinCostUnsettledNode(){
	var min_cost_unsettled = 1000; //assumed infiniteish value
	var min_cost_unsettled_node = "";
	for (var k = 0; k < Object.keys(path_node_cost).length; k++){		
		var key = Object.keys(path_node_cost)[k];		
		if (key.indexOf("_settledflag") >= 0 && path_node_cost[key] == false){
			var key_part1 = key.substring(0,4);
			if (  !isNaN(path_node_cost[key_part1 + "_cost"]) && path_node_cost[key_part1 + "_cost"] < min_cost_unsettled){
				min_cost_unsettled = path_node_cost[key_part1 + "_cost"];
				min_cost_unsettled_node = key_part1.substring(3,4);
			}			
		}
	}
	return min_cost_unsettled_node;
}
	

				
/**
 * Fills the least cost unsettled node and marks as visited.
 * @param {string} startNode - The label of the node.
 * @param {string} related_chnl - The label of the node (unused). 
 * @param {string} via - The predecessor node label.  
 */
function callMarkSelected(startNode, related_chnl, cost, via){
	removeAllTextOutput();	
	if(startNode == src){
		populateTextOutput("desc_line_1", "Starting traversal at " + startNode);
	} else {
		populateTextOutput("desc_line_1", "Selecting " + startNode + " (lowest cost unsettled node)" );
	}	
	populateTextOutput("desc_line_2", "Hence, " + startNode + " marked as settled");
	if(startNode == dest){
		populateTextOutput("desc_line_3", "Destination Reached ..");
		setTimeout(function(){ displayPathFound(); }, 3*delayFactor);
	}
	markNodeAsVisited(startNode, cost, via, 0);
	setTimeout(function(){ removeAllTextOutput(); }, 2*delayFactor);
}
				


/**
 * Highlights the sender to destination path.
 */				
function displayPathFound(){
	var dest_text_elem = document.getElementById("node_cost_text_" + dest);
	var dest_text_elem_content = dest_text_elem.textContent;
	var dest_cost = (dest_text_elem_content.split(",")[0]).split("(")[1]
	var dest_prev = (dest_text_elem_content.split(",")[1]).split(")")[0];
	populateTextOutput("desc_line_1", "Shortest Path from " + src + " to " + dest + ": " + dest_cost   );
	var outcome_text_elem = document.getElementById("desc_line_1");
	outcome_text_elem.setAttribute("style", "stroke:green");
	populateTextOutput("desc_line_3", "Path highlighted in green"   );			
	var srcReachedFlag = false;
	var rev_path = dest; /* initial value before while loop */
	var cur_node = dest;  /* initial value before while loop */
	var prev_node = dest_prev;  /* initial value before while loop */
	while (!srcReachedFlag){
		if (cur_node != dest){
			var cur_node_text_elem = document.getElementById("node_cost_text_" + cur_node);
			var cur_node_text_elem_content = cur_node_text_elem.textContent;
			var prev_node = (cur_node_text_elem_content.split(",")[1]).split(")")[0];
		}
		rev_path += prev_node;
		var cur_prev_chnl_id = determineReqChnlDet(cur_node+prev_node).id;
		document.getElementById(cur_prev_chnl_id).setAttribute("style", "stroke:green;stroke-width:2");
		cur_node = prev_node;
		srcReachedFlag = cur_node == src ? true : false;
	}
	/*credit of reverse logic goes to belacqua in https://stackoverflow.com/questions/958908/how-do-you-reverse-a-string-in-place-in-javascript */
	var fwd_path = rev_path.split("").reverse().join("");
	outcome_text_elem = document.getElementById("desc_line_2");
	outcome_text_elem.setAttribute("style", "stroke:green");
	populateTextOutput("desc_line_2", "Path: " + fwd_path  );
	resetOtherNodeChnl(fwd_path);
	resetFlags();
	
}					



/**
 * Resets fill,channel, and cost text for other nodes
 * @param {string} fwd_path - The path chosen
 */
function resetOtherNodeChnl(fwd_path){
	var nodes = document.getElementsByClassName("node_type");
	for (var m=0; m<nodes.length; m++){
		if(fwd_path.indexOf( nodes[m].getAttribute("id").split("_")[1]) < 0){
			nodes[m].setAttribute("fill", "grey");
		}
		
	}			
	//alert(8);
	var chnls = document.getElementsByClassName("chnl_type");
	for (var n=0; n<chnls.length; n++){
		var chnl_nodes_comb1 = chnls[n].getAttribute("id").split("_")[1] + chnls[n].getAttribute("id").split("_")[2];
		var chnl_nodes_comb2 = chnls[n].getAttribute("id").split("_")[2] + chnls[n].getAttribute("id").split("_")[1];
		if(fwd_path.indexOf(chnl_nodes_comb1)  < 0 && fwd_path.indexOf(chnl_nodes_comb2)  < 0){
			chnls[n].setAttribute("style", "stroke:#000000;stroke-width:2");
		}
		
	}		
	//alert(9);
	var node_cost_texts = document.getElementsByClassName("node_cost_text");
	for (var p=0; p<node_cost_texts.length; p++){
		//alert(2777 + txtelems[m]);
		var node_cost_text = node_cost_texts[p];
		if( fwd_path.indexOf( node_cost_text.getAttribute("id").split("_")[3] ) < 0){
			node_cost_text.setAttribute("style", "stroke:none");
		}
		
	}
}



/**
 * Resets flag for retry, signifying end of run.
 */
function resetFlags(){
	//alert(44);
	firstRunSincePgLoadFlg = false;
	inProgFlg = false;
}


			
/**
 * Calls the function which handles under-assessment nodes.
 * @param {string} startNode - The label of the start node.
 * @param {string} related_chnl - The link name.
 * @param {string} child_seq - The sequence of child in the children list of the start node.
 * @param {string} candidate - The current child node candidate.
 * @param {string} cand_cost - The cost to reach the candidate.
 */			
function callShowUnderAssessment(startNode, related_chnl, child_seq, candidate, cand_cost, type){
	setTimeout(function(){showUnderAssessment(startNode, related_chnl, child_seq, candidate, cand_cost, type); }, 4*delayFactor);
}
				


/**
 * Fills entities with highlighting colours to show them as under-assessment.
 * @param {string} startNode - The label of the start node.
 * @param {string} related_chnl - The link name.
 * @param {string} child_seq - The sequence of child in the children list of the start node.
 * @param {string} candidate - The current child node candidate.
 * @param {string} cand_cost - The cost to reach the candidate.
 */			
function showUnderAssessment(startNode, chnl, child_seq, candidate, cand_cost, type){
	document.getElementById(chnl).setAttribute("style", "stroke:yellow;stroke-width:2");
	populateTextOutput("desc_line_" + child_seq, "Getting child node " + candidate + " cost from " + startNode);
	setTimeout(function(){ populateTextOutput("desc_line_" + child_seq, "Marked " + candidate + " with unsettled cost"); }, 2*delayFactor);
	setTimeout(function(){ removeTextOutput("desc_line_" + child_seq); }, 3*delayFactor);
	markNodeAsVisited(candidate, cand_cost, startNode, 1);//marking unsettled
}
				

				
/**
 * Checks if a node has been visited.
 * @param {string} node - The label of the node being checked.
 */			
function hasBeenVisited(node){
	var visitedflag = false;
	if(!(nodes_visited.indexOf(node) < 0)){
		visitedflag =  true;
	}
	return visitedflag;
}
				


/**
 * Simulates the ping between neighbours.
 * @param {string} node - The label of the node.
 */	
function simulateEchoPkt(ref_node){					
	populateTextOutput("desc_line_1", "Pinging neighbours for cost .."); 
	setTimeout(function(){ populateTextOutput("desc_line_1", "Costs estimated .."); }, ping_dur*1000);
	setTimeout(function(){ removeTextOutput("desc_line_1") }, ping_dur*1000 + delayFactor);					
	for (var i = 0; i < adjNodeObj[ref_node].length; i++){
		var anim_path = getAnimPath(ref_node + adjNodeObj[ref_node][i]);
		pingNeighbour(anim_path.anim_path_roundtrip, 0);
	}
}



/**
 * Displays a text in the output text field.
 * @param {string} textField - The name of the output text field.
 * @param {string} text - The text to be displayed.
 */			
function populateTextOutput(textField,text){
	var output_txtelem_1 = document.getElementById(textField);
	output_txtelem_1.textContent = text;
	output_txtelem_1.setAttribute("fill-opacity", "1");
}


				
/**
 * Removes text from an output text field.
 * @param {string} textField - The name of the output text field.
 */					
function removeTextOutput(textField){
	var output_txtelem_1 = document.getElementById(textField);
	output_txtelem_1.textContent = "";
}



/**
 * Removes text from all output text fields.
 */	
function removeAllTextOutput(){	
	var txtelems = document.getElementsByClassName("desc_line");
	for (var m=0; m<txtelems.length; m++){
		var txtelem = txtelems[m];
		if (txtelem.getAttribute("id") != "desc_line_9"){
			txtelem.textContent = "";
			txtelem.setAttribute("style", "stroke:none");
		}

	}		
}	


			
/**
 * Calculates costs of all links in diagram.
 */					
function measureLineDelays(){
	var chnl_list = document.getElementsByClassName("chnl_type");
	for (var i = 0; i < chnl_list.length; i++) {
		var chnl_id = chnl_list[i].getAttribute("id");
		var cost_xPos = (Number(chnl_list[i].getAttribute("x1")) + Number(chnl_list[i].getAttribute("x2")))/2;
		var cost_yPos = (Number(chnl_list[i].getAttribute("y1")) + Number(chnl_list[i].getAttribute("y2")))/2;						
		var chnl_cost = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		chnl_cost.setAttribute("class", "chnlcost");
		chnl_cost.setAttribute("id", "chnlcost_" + chnl_id);
		chnl_cost.setAttribute("x", cost_xPos);
		chnl_cost.setAttribute("y", cost_yPos);		
		//alert(!runFlag);
		if (manual_cost_flg == "R" && firstRunSincePgLoadFlg){
			chnl_delays[chnl_id] = Math.floor((Math.random() * 19) + 1);
			//alert(chnl_delays[chnl_id]);
		}
		
		chnl_cost.textContent = chnl_delays[chnl_id];
		document.getElementById("full_enclosure_svg").appendChild(chnl_cost);
		//firstRunSincePgLoadFlg = false;								
	}					
}
				


/**
 * Determines the path for the ping animation.
 * @param {string} path_echo - The nodename based path for the ping animation.
 */			
function getAnimPath(path_echo){			
	var anim_path = "";
	var assoc_nodes = [];
	for (var i = 0; i < path_echo.length; i++){
		assoc_nodes.push(path_echo.substring(i,i+1));
		var circ = document.getElementById("node_" + path_echo.substring(i,i+1));
		var xPos = circ.getAttribute("cx");
		var yPos = circ.getAttribute("cy");
		anim_path = i == 0 ? anim_path + "M" + xPos + "," + yPos : anim_path + " L" + xPos + "," + yPos;						
	}
	var anim_path_fwd = anim_path;
	for (var j = path_echo.length - 1; j > 0 ; j--){
		var circ_rev = document.getElementById("node_" + path_echo.substring(j-1,j));
		var xPos_rev = circ_rev.getAttribute("cx");
		var yPos_rev = circ_rev.getAttribute("cy");
		anim_path = anim_path + " L" + xPos_rev + "," + yPos_rev;
	}
	return {anim_path_roundtrip:anim_path, anim_path_fwd:anim_path_fwd};											
}
				

				
/**
 * Performs the ping animation between neighbours.
 * @param {string} anim_path - The nodename based path for the ping animation.
 * @param {string} mode - The mode of animation - to-and-fro or one-way only.
 */				
function pingNeighbour (anim_path, mode) {	
					
	var init = anim_path.substring(0, anim_path.length).split(" ")[0];										
	var x = init.split(",")[0].split(".")[0];
	var y = init.split(",")[1].split(".")[0];					
	var path_wo_chars = replaceAll(replaceAll(anim_path, ",", ""), " ", "");
		
	var connsig_circ = document.createElementNS(svgnamespace, "circle");	
	connsig_circ.setAttribute("class", "pingconnsig");														
	connsig_circ.setAttribute("id", "cktconnsig_" + mode + "" + path_wo_chars);
	connsig_circ.setAttribute("r", "3");	// TEST assumed to be 2
	connsig_circ.setAttribute("style", "stroke: none; fill: #0000ff;")
										
	var ani = document.createElementNS(svgnamespace,"animateMotion");
	ani.setAttribute("id", "cktconnsig_anim_" + mode + "" + path_wo_chars);						
	ani.setAttribute("dur", ping_dur + "s");  //TEST value of 2 (see top of page) assumed					
	//credit goes to https://stackoverflow.com/questions/12865888/getting-the-current-time-of-an-svganimation-element-in-svg-tiny-1-2
	var elapsedSincePgLoad = document.getElementById("full_enclosure_svg").getCurrentTime();
	ani.setAttribute("begin", elapsedSincePgLoad + "s");						
	ani.setAttribute("repeatCount", "1");
	ani.setAttribute("fill", "remove");

	var path = document.createElementNS(svgnamespace,"path");
	path.setAttribute("id", "dpath_" + mode + "" + path_wo_chars);
	path.setAttribute("d", anim_path);
	path.setAttribute("stroke", "lightgrey");
	path.setAttribute("stroke-width", "0");
	path.setAttribute("fill", "none");

	var mpath = document.createElementNS(svgnamespace,"mpath");
	mpath.setAttribute("id", "mpath_" + mode + "" + path_wo_chars);
	mpath.setAttributeNS('http://www.w3.org/1999/xlink','href',"#dpath_"  + mode + "" + path_wo_chars);

	var set_end = document.createElementNS(svgnamespace,"set");
	set_end.setAttribute("id", "setend_cktanim_" + mode + "" + path_wo_chars);
	set_end.setAttribute("attributeName", "r");  
	set_end.setAttribute("attributeType", "XML");
	set_end.setAttribute("to", "0");
	set_end.setAttribute("begin", "cktconnsig_anim_" + mode + "" + path_wo_chars + ".end");
						
	document.getElementById("full_enclosure_svg").appendChild(path);
	ani.appendChild(mpath);
	connsig_circ.appendChild(ani);
	connsig_circ.appendChild(set_end);
	document.getElementById("full_enclosure_svg").appendChild(connsig_circ);
}
				

				
/**
 * Utility function to replace all occurrences of a pattern with another string.
 * @param {string} str - The string upon which search is done.
 * @param {string} find - The searched string.
 * @param {string} replace - The string which replaces the searched string.
 */				
/*	credit goes to https://stackoverflow.com/questions/1144783/how-to-replace-all-occurrences-of-a-string-in-javascript	*/
function replaceAll(str, find, replace) {
	return str.replace(new RegExp(find, 'g'), replace);
}
				


/**
 * Obtains coordinates of the centre of the circle that represents node.
 * @returns {object} The x coordinates of the node.
 * @returns {object} The y coordinates of the node.
 * @param {string} node_name - The label of the node.
 */								
function getNodePos(node_name){
	var circ_node = document.getElementById("node_" + node_name);
	var xPos = circ_node.getAttribute("cx");
	var yPos = circ_node.getAttribute("cy");
	return {x:xPos, y:yPos};
}
					

				
/**
 * Utility function that returns the key characteristics of a link i.e. section between two neighbours.
 * @returns {object} The characteristics of the link joining the two nodes.
 * @param {string} section - The appended names of two linked neighbouring nodes, e.g. AB 
 */
function determineReqChnlDet(section) {
	var section_from = section.substring(0,1);
	var section_to = section.substring(1,2);
	var chnl_elem = document.getElementById("chnl_" + section_from + "_" + section_to) == null ?
	document.getElementById("chnl_" + section_to + "_" + section_from) : 
	document.getElementById("chnl_" + section_from + "_" + section_to);
	var swapflag = document.getElementById("chnl_" + section_from + "_" + section_to) == null ? true : false;
	var chnl_id = "";
	var chnl_x1 = "";
	var chnl_y1 = "";
	var chnl_x2 = "";
	var chnl_y2 = "";
	var chnlBusyFlag = false;	
	if (chnl_elem != null){
		chnl_id = chnl_elem.getAttribute("id");						
		chnl_x1 = swapflag == true ? chnl_elem.getAttribute("x2") : chnl_elem.getAttribute("x1");
		chnl_y1 = swapflag == true ? chnl_elem.getAttribute("y2") : chnl_elem.getAttribute("y1");
		chnl_x2 = swapflag == true ? chnl_elem.getAttribute("x1") : chnl_elem.getAttribute("x2");
		chnl_y2 = swapflag == true ? chnl_elem.getAttribute("y1") : chnl_elem.getAttribute("y2");
		var databar = document.getElementById("full_enclosure_svg").getElementById("databar_" + section_from + section_to + "_" +  chnl_id);
		if(databar != null && databar.getAttribute("width") > 0){
			chnlBusyFlag = true;
		}
	}					
	return {elem:chnl_elem,id:chnl_id,nodeNameSwapped:swapflag,x1:chnl_x1,y1:chnl_y1,x2:chnl_x2,y2:chnl_y2,busy:chnlBusyFlag};
}
	

			
/**
 * Checks if an unit of data transfer on a link is complete.
 * @param {string} block_interval_val - The repeating window interval value.
 * @param {string} chnl_id - The name of the link.
 * @param {string} sdr - The original sender of the data unit.
 * @param {string} rcvr - The final destination for the data unit. 
 * @param {string} anim_path_fwd - The forward one-way animation path.
 * @param {string} assoc_nodes - All nodes in the path of animation. 
 */				
function checkCommComplete(block_interval_val, chnl_id, sdr, rcvr, anim_path_fwd, assoc_nodes){
	var active_msg_length = document.getElementById("databar_" + sdr + rcvr + "_" + chnl_id).getAttribute("width");
	if (active_msg_length == 0) {
		setTimeout(function(){showAsAvailableNode(assoc_nodes)}, cDisconnTime*1000);							
		//animateCktSetupAndDisconnect(anim_path_fwd, 1);
		updateActivePathList(sdr, rcvr);
		clearInterval(intervals[block_interval_val]);
		intervals[block_interval_val] = -1;
		endedCount++;
		var timetaken_elem = document.getElementById("timetaken_" + endedCount);
		timetaken_elem.textContent = sdr + " to " + rcvr + " time taken:  " + (document.getElementById("full_enclosure_svg").getCurrentTime() - clockStartTime).toPrecision(6) + " s";
		timetaken_elem.setAttribute("fill-opacity", "1");
	}
}
					


/* common functions below */


/**
 * Initiates the available node names upon page load.
 * @param {string} event - Unused.
 */									
function init(event){
	for (var i = (64 + limitOfNodes); i > 64; i--) { 	//Corresponding to ascii characters
		availableNodeNames.push(String.fromCharCode(i));							
	}				
}
					

					
/**
 * Obtains the coordinates of the click event in svg canvas.
 * @returns {object} x and y coordinates of the event, i.e. the click.
 * @param {object} event - The event triggered.
 */					
function getRelCoordinates(event){
	var parent_dim = event.target.getBoundingClientRect();
	var xPos = event.clientX - parent_dim.left;
	var yPos = event.clientY - parent_dim.top;
	return {x:xPos,y:yPos};
}
					


/**
 * Validates the position of the click and if valid, calls the function that draws the node.
 * @param {object} event - The event triggered.
 */
function createNode(event) {
	var relCoordinates = getRelCoordinates(event);
	var xPos = relCoordinates.x;
	var yPos = relCoordinates.y;						
	if (notExceedingLimit() && atAllowedDistance(xPos, yPos)){
		var thisnode_name = availableNodeNames.pop();
		drawNode (thisnode_name, xPos, yPos);							
		numOfNodes ++;		
		usedNodeNames.push(thisnode_name);
		adjNodeObj[thisnode_name] = [];
	} else {
		alert ("Nodes exceeding limit or too close to existing node");
	}						
}


						
/**
 * Reads the user click event on the node element and calls the function that draws a link between two nodes.
 * @param {object} event - The event triggered.
 */			
function prepChannelDraw (event) {			         
	var parent_dim = event.target;
	var clickNode = parent_dim.getAttribute("id").substring(parent_dim.getAttribute("id").length - 1, parent_dim.getAttribute("id").length);
	var cont_circ = document.getElementById("node_" + clickNode);
	var clickxPos = cont_circ.getAttribute("cx");
	var clickyPos = cont_circ.getAttribute("cy");						
	if(chnlClickFlg == false){
		chnlInitPos = [clickxPos, clickyPos, clickNode];
		chnlClickFlg = true;
	} else {
		/* for the scenario where two consecutive clicks are on same node - avoiding self-links*/
		if(chnlInitPos[2] != clickNode){
			chnlFinalPos = [clickxPos, clickyPos, clickNode];
			chnlClickFlg = false;		
			drawChannel (chnlInitPos[0], chnlInitPos[1], chnlInitPos[2], chnlFinalPos[0], chnlFinalPos[1], chnlFinalPos[2]);
		}
	}
}



/**
 * Draws a link between two nodes.
 * @param {string} init_x - x coordinate of start node.
 * @param {string} init_y - y coordinate of end node.
 * @param {string} init_node - The start node.
 * @param {string} final_x - x coordinate of end node.
 * @param {string} final_y - y coordinate of end node.
 * @param {string} final_node - The end node. 
 */			
function drawChannel (init_x, init_y, init_node, final_x, final_y, final_node){
	if(determineReqChnlDet(init_node + final_node).elem == null){
		var chnl = document.createElementNS("http://www.w3.org/2000/svg", "line");
		chnl.setAttribute("class", "chnl_type");
		chnl.setAttribute("id", "chnl_" + init_node + "_" + final_node);
		chnl.setAttribute("x1", init_x);
		chnl.setAttribute("y1", init_y);
		chnl.setAttribute("x2", final_x);
		chnl.setAttribute("y2", final_y);
		chnl.setAttribute("style", "stroke:#000000;stroke-width:2");
		document.getElementById("full_enclosure_svg").appendChild(chnl);						
		if (adjNodeObj[init_node].indexOf(final_node) < 0){
			adjNodeObj[init_node].push(final_node);
		}
		if (adjNodeObj[final_node].indexOf(init_node) < 0){
			adjNodeObj[final_node].push(init_node);
		}
		chnl_delays["chnl_" + init_node + "_" + final_node] = 0;
	}										
}
					


/**
 * Calculates distance between two nodes.
 * @returns calculated distance
 * @param {string} init_x - x coordinate of start node.
 * @param {string} init_y - y coordinate of end node.
 * @param {string} final_x - x coordinate of end node.
 * @param {string} final_y - y coordinate of end node. 
 */				
function calculateDistance (init_x, init_y, final_x, final_y){
	// calculation referred from codeopen - "https://codepen.io/daveboling/pen/jWOorz"
	return (Math.sqrt((init_x -= final_x) * init_x + (init_y -= final_y) * init_y));					
}
			


/**
 * Calculates anle of inclination between two nodes.
 * @returns calculated angle
 * @param {string} init_x - x coordinate of start node.
 * @param {string} init_y - y coordinate of end node.
 * @param {string} final_x - x coordinate of end node.
 * @param {string} final_y - y coordinate of end node. 
 */			
function calculateAngleInDegrees(init_x, init_y, final_x, final_y) {
	// calculation referred from codeopen - "https://codepen.io/netsi1964/pen/WrRGoo"
	var dy = (final_y - init_y);
	var dx = (final_x - init_x);
	var theta = Math.atan2(dy, dx);
	var angle = (((theta * 180) / Math.PI)) % 360;
	angle = (angle<0) ? 360+angle : angle;
	return angle;
}

			
			
/**
 * Checks if maximum allowed nodes threshold already reached.
 * @returns boolean result if threshold already reached
 */					
function notExceedingLimit (){
	return numOfNodes < limitOfNodes;
}


				
/**
 * Checks if node attempted is at minimum (predetermined) distance from another node.
 * @returns boolean result.
 * @param {string} xPos - The x position of intended node.
 * @param {string} yPos - The y position of intended node.
 */							
function atAllowedDistance(xPos, yPos){
	var outcome = true;
	var curr_nodes = document.getElementsByClassName("node_type");
	if (curr_nodes.length > 0) {
		for (var i = 0; i < curr_nodes.length; i++) {							
			if ((xPos - curr_nodes[i].getAttribute("cx") < disallowedRegion) && (xPos - curr_nodes[i].getAttribute("cx") > -disallowedRegion) 
			&& (yPos - curr_nodes[i].getAttribute("cy") < disallowedRegion) && (yPos - curr_nodes[i].getAttribute("cy") > -disallowedRegion)){
				outcome = false;
				break;
			}
																
		}
	}
	return outcome;
}



/**
 * Draws a node.
 * @param {string} thisnode_name - The name of the node.
 * @param {string} xPos - The x position of intended node.
 * @param {string} yPos - The y position of intended node.
 */							
function drawNode (thisnode_name, xPos, yPos){				
	var circ = document.createElementNS("http://www.w3.org/2000/svg", "circle");
	circ.setAttribute("class", "node_type");
	circ.setAttribute("id", "node_" + thisnode_name);
	circ.setAttribute("cx", xPos);
	circ.setAttribute("cy", yPos);
	circ.setAttribute("r", radiusCirc);
	circ.setAttribute("style", "stroke:#000000");
	circ.setAttribute("fill", "grey");
	circ.setAttribute("onclick", "prepChannelDraw(event)");
	document.getElementById("full_enclosure_svg").appendChild(circ);
							
	var node_name = document.createElementNS("http://www.w3.org/2000/svg", "text");
	node_name.setAttribute("id", "node_name_" + thisnode_name);
	node_name.setAttribute("x", xPos - fontSize);
	node_name.setAttribute("y", yPos + fontSize);
	node_name.setAttribute("onclick", "prepChannelDraw(event)");
	node_name.textContent = thisnode_name;
	document.getElementById("full_enclosure_svg").appendChild(node_name);
					
	var node_cost_text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
	node_cost_text.setAttribute("class", "node_cost_text");
	node_cost_text.setAttribute("id", "node_cost_text_" + thisnode_name);
	node_cost_text.setAttribute("x", xPos-10);
	node_cost_text.setAttribute("y", yPos + 35);
	node_cost_text.textContent = "";
	document.getElementById("full_enclosure_svg").appendChild(node_cost_text);					
}



/**
 * Calls function which draws node and invalidates multiple node creation out of single click of point-and-click image.
 * @param {object} event - The event triggered.
 */	
function prepNodeDraw (event) {
	if (nodeClickFlg){
		createNode(event);
		nodeClickFlg = false;
	}
}


	
/**
 * Function that signifies click of point-and-click image before a node is drawn.
 */			
function readyForNode () {
	nodeClickFlg = true;
}



/**
 * Function that makes visible tool tip for the point-and-click image for drawing node.
 */	
function showToolTip() {
	document.getElementById("circ_tooltip").setAttribute("fill-opacity", "1");
}



/**
 * Function that makes invisible tool tip for the point-and-click image for drawing node.
 */
function hideToolTip() {
	document.getElementById("circ_tooltip").setAttribute("fill-opacity", "0");
}