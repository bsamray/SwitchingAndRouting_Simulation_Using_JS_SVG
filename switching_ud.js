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
	
var nodeClickFlg = false;	
var chnlClickFlg = false;
var intervals = {};
	
var paths = {};
var sdr_rcvr_pairs = [];
var ckt_ongoing = [];
var pkt_ongoing = [];
	
//used during path determination for a sender receiver pair
var pathsfound = [];
var visited = [];
	
//OLD test values - start - real values populated					
var pLength =  100; /* message length (bits)	*/
var pRate = 20;			/* transmission rate in bits/sec	*/
var pTDelay = 2;	/* transmission delay per link */	
var sw_mode = "C";
var pkt_dg_flag = true;
var pkt_vc_flag = false;
var cSetupTime = 10;   /* CIRCUIT - set up time for circuit switch	*/
var pMaxLen = 11;   /* PACKET - header size (bits) */
var pHeadLen = 1;   /* PACKET - packet size limit(bits) */
var pRDelay = 1;	/* PACKET - decision time per packet */	
var cDisconnTime = 0.5; /* circuit disconnection time - assumed to be 0.5 sec */
var invalidFields = "";
var sdr_rcvr_pairs = [];	
var clockStartTime = 0;
var endedCount = 0;	
/* packet specific vars */
var pkt_nodes_master = {};
/* colour codes chosen from http://htmlcolorcodes.com/ */
var data_rect_fills = ["#808000", "#00FFFF", "#E59866", "#0000FF", "#800080", "#008000", "#5D6D7E", "#DAF7A6", "#330066", "#660033"];
var sdrrcvr_fill_map = {};



/**
 * Validates user input.
 * @returns {boolean} validFlag - The outcome of validation.
 */						
function validateInput(){
	var validFlag = true;		
	pLength = document.getElementById("messageLength").value;
	if (isNaN(document.getElementById("messageLength").value)){
		validFlag = false; 
		invalidFields += " \nmessageLength";
	}		
	pRate = document.getElementById("transmissionRate").value;
	if (isNaN(document.getElementById("transmissionRate").value)){
		validFlag = false; 
		invalidFields += " \ntransmissionRate";
	}		
	pTDelay = document.getElementById("transmissionDelay").value;
	if (isNaN(document.getElementById("transmissionDelay").value)){
		validFlag = false; 
		invalidFields += " \ntransmissionDelay";
	}		
	sw_mode = document.getElementById("switchMethod").value;
	if (!(sw_mode == "C" || sw_mode == "P")){
		validFlag = false; 
		invalidFields += " \nswitchMethod";
	}		
	cSetupTime = document.getElementById("setupTime").value;
	if (sw_mode == "C" && isNaN(document.getElementById("setupTime").value)){
		validFlag = false; 
		invalidFields += " \nsetupTime";
	}								
	var pkt_mode = document.getElementById("packetMode").value;
	pkt_dg_flag = pkt_mode == "DG" ? true : false; 
	pkt_vc_flag = pkt_mode == "VC" ? true : false;
	if (sw_mode == "P"){
		if (!(pkt_mode == "DG" || pkt_mode == "VC")){
			validFlag = false;
			invalidFields += " \npacketMode";
		}
	}		
	pMaxLen = document.getElementById("maximumPacketSize").value;
	if (sw_mode == "P" && isNaN(document.getElementById("maximumPacketSize").value)){
		validFlag = false; 
		invalidFields += " \nmaximumPacketSize";
	}		
	pHeadLen = document.getElementById("packetHeaderLength").value;
	if (	(sw_mode == "P" && isNaN(document.getElementById("packetHeaderLength").value))	|| (Number(pHeadLen) > Number(pMaxLen))  ){
		validFlag = false; 
		invalidFields += " \npacketHeaderLength";
	}		
	pRDelay = document.getElementById("packetRoutingDelay").value;
	if (sw_mode == "P" && isNaN(document.getElementById("packetRoutingDelay").value)){
		validFlag = false; 
		invalidFields += " \npacketRoutingDelay";
	}		
	sdr = document.getElementById("packetRoutingDelay").value;
	if (sw_mode == "P" && isNaN(document.getElementById("packetRoutingDelay").value)){
		validFlag = false; 
		invalidFields += " \npacketRoutingDelay";
	}		
	//referred to mohagali - https://stackoverflow.com/questions/23476532/check-if-string-contains-only-letters-in-javascript
	sdr_rcvr_pairs = document.getElementById("pairsSdrRcvr").value.trim().split(",");
	if (sdr_rcvr_pairs.length > 0 || sdr_rcvr_pairs.length < 10){
		for (var i=0; i < sdr_rcvr_pairs.length; i++){
			if ( sdr_rcvr_pairs.indexOf(sdr_rcvr_pairs[i]) !== sdr_rcvr_pairs.lastIndexOf(sdr_rcvr_pairs[i]) || !(/^[A-Z][A-Z]$/.test(sdr_rcvr_pairs[i])) || sdr_rcvr_pairs[i].length != 2  || !chkNodeExists(sdr_rcvr_pairs[i]) ) {
				validFlag = false; 
				invalidFields += " \nSender-Receiver Pair:" + sdr_rcvr_pairs[i];
				break;
			}	
		}
	} else {
		validFlag = false; 
		invalidFields += " \nSender-Receiver Pairs";
	}	
	invalidFields = invalidFields.length > 0 ? invalidFields.substring(1, invalidFields.length) : "";
	return validFlag;
}



/**
 * Validates if either of node in a sender-receiver pair is not present in network.
 * @returns {boolean} existsFlag - Result of the check. 
 * @param {string} sdr_rcvr_pair - A sender-receiver pair.
 */
function chkNodeExists(sdr_rcvr_pair){
	var existsFlag = true;
	if (document.getElementById("node_" + sdr_rcvr_pair.substring(0,1)) == null || document.getElementById("node_" + sdr_rcvr_pair.substring(1,2)) == null){
		existsFlag = false;
	}
	return existsFlag;
}



/**
 * Activates relevant input fields based on choice of circuit or packet switching.
 * @param {string} switchMethod - Indicator for circuit or packet switching.
 */
/* onchange method of select working is credited to http://jsfiddle.net/mplungjan/eqffs/ */
function activateInputFields(switchMethod){
	if(switchMethod.value == "C"){
		document.getElementById("setupTime_label").setAttribute("class", "label");
		document.getElementById("setupTime").removeAttribute("disabled");										
		document.getElementById("packetMode_label").setAttribute("class", "label_inactive_init");
		document.getElementById("packetHeaderLength_label").setAttribute("class", "label_inactive_init");
		document.getElementById("maximumPacketSize_label").setAttribute("class", "label_inactive_init");
		document.getElementById("packetRoutingDelay_label").setAttribute("class", "label_inactive_init");
		document.getElementById("packetMode").setAttribute("disabled", "disabled");
		document.getElementById("packetHeaderLength").setAttribute("disabled", "disabled");
		document.getElementById("maximumPacketSize").setAttribute("disabled", "disabled");
		document.getElementById("packetRoutingDelay").setAttribute("disabled", "disabled");
	} else if(switchMethod.value == "P"){
		document.getElementById("packetMode_label").setAttribute("class", "label");
		document.getElementById("packetHeaderLength_label").setAttribute("class", "label");
		document.getElementById("maximumPacketSize_label").setAttribute("class", "label");
		document.getElementById("packetRoutingDelay_label").setAttribute("class", "label");
		document.getElementById("packetMode").removeAttribute("disabled");
		document.getElementById("packetHeaderLength").removeAttribute("disabled");
		document.getElementById("maximumPacketSize").removeAttribute("disabled");
		document.getElementById("packetRoutingDelay").removeAttribute("disabled");			
		document.getElementById("setupTime_label").setAttribute("class", "label_inactive_init");
		document.getElementById("setupTime").setAttribute("disabled", "disabled");
	}
}



/**
 * Captures user button click and routes to appropriate routing functon.
 */
function startAnim(){
	removeAnimElements("end", ["cktconnsig", "rect_msg", "databar_pkt"]);	/* for retries */
	if(!validateInput()){
		alert("Invalid input:" + invalidFields);
		invalidFields = "";
	} else {		
		prepOutputArea();
		if (sw_mode == "C"){
			prepareCircuitSw();
		} else if (sw_mode == "P"){
			preparePacketSw();
		}
	}
}	
	

	
/**
 * Prepares for packet switching animation by calling functions required for packet animation and deciding on the path to be followed.
 */		
function preparePacketSw() {		
	clockStartTime = document.getElementById("full_enclosure_svg").getCurrentTime();
	endedCount = 0;
	var data_rect_fills_tmp = data_rect_fills.slice();
	var pkt_dets = calculatePktStats();		
	for (var i = 0; i < sdr_rcvr_pairs.length; i++){			
		var cur_sdr_pair = sdr_rcvr_pairs[i];
		var sdr = cur_sdr_pair.substring(0,1);
		var rcvr = cur_sdr_pair.substring(1,2);
		sdrrcvr_fill_map[cur_sdr_pair] = data_rect_fills_tmp.shift();
		//alert(cur_sdr_pair + " " + sdrrcvr_fill_map[cur_sdr_pair] + " " + data_rect_fills_tmp.length);
		determinePaths(sdr, rcvr);			
		var stored_paths = paths[sdr + rcvr].slice();
		var selected_path = [];
		if (pkt_vc_flag){
			var rand_num = Math.floor(Math.random() * stored_paths.length);
			selected_path.push(stored_paths[rand_num]);
		} else {								
			//copies the array in a new array without reference to old variable
			selected_path = stored_paths.slice();
		}
		//reinitialise temp arrays 
		pathsfound = [];
		visited = [];
		var anim_path = "";
		for (var j = 0; j < pkt_dets.pktCount; j++){				
			//selects only avaialbale selected path for virtual circuit, whereas for Datagram, chooses one of the paths
			var rand_num2 = Math.floor(Math.random() * selected_path.length);
			prepareNodeQsIfNeeded(selected_path[rand_num2]);
			pkt_ongoing.push(selected_path[rand_num2]);				
			var q_pkt_entity = {pkt_id:sdr+rcvr+"_"+j, status:0, path:selected_path[rand_num2], sdr:sdr, rcvr:rcvr, overall_pkt_info:pkt_dets}; //status 0 means unprocessed packet
			var anim_path_types = setupVCPkt(selected_path[rand_num2]);
			anim_path = anim_path == "" ? anim_path_types.anim_path_roundtrip : anim_path;
			placePktOnNodeQ(q_pkt_entity, selected_path[rand_num2].substring(0,1));
		}				
		animatePktSetupAndDisconnect(anim_path, 0);					
	}		
}
	


/**
 * Places packet on logical node queue.
 * @param {object} pkt - The packet.
 * @param {string} node - The node whose queue will hold the packet.
 */		
function placePktOnNodeQ(pkt, node){
	pkt_nodes_master[node].push(pkt);
}



/**
 * Checks node queue for eligible packet and initiates packet transfer if found.
 * @param {string} node - The node being checked.
 */	
function checkNodeQforPkt(node){
	if(foundEligibleMsg(node)){
		pkt_nodes_master[node][0]["status"] = 1; 
		schedulePktTransfer(pkt_nodes_master[node][0], node);
	} 
}



/**
 * Checks for eligible message on node queue.
 * @param {boolean} pickMsgFlag - The outcome of the check. 
 * @param {string} node - The node being checked.
 */	
function foundEligibleMsg(node){	
	var pickMsgFlag = false;
	if (pkt_nodes_master[node][0]["status"] == 0){	//0 means not picked, 1 means picked and in progress, pkt removed when done
		pickMsgFlag = true;
	}
	return pickMsgFlag;
}




/**
 * Remove packet from a node queue. Schedules move of this packet to another node.
 * @param {object} pkt - The packet.
 * @param {string} node_src - The node from.
 * @param {string} node_dest - The node to.
 */	
function movePktFromNodeQ(pkt, node_src, node_dest){
	/* node_dest is "0" when destination reached */
	var src_pkt = pkt_nodes_master[node_src][0];
	setTimeout(function(){  movePktToNextNodeQ(src_pkt, node_src, node_dest)  }, Number(pTDelay) * 1000);
	pkt_nodes_master[node_src].shift();
}



/**
 * Move packet from a node queue to another. 
 * @param {object} pkt - The packet.
 * @param {string} node_src - The node from.
 * @param {string} node_dest - The node to.
 */
function movePktToNextNodeQ(pkt, node_src, node_dest){
	if(node_dest != "0"){
		pkt_nodes_master[node_dest].push(pkt);
		var newlength_node_dest = pkt_nodes_master[node_dest].length;
		pkt_nodes_master[node_dest][newlength_node_dest - 1]["status"] = 0;
	} 
}



/**
 * Creates logical queues for nodes, if needed, in a selected path.
 * @param {string} selected_path - The selected path for a packet transfer.
 */		
function prepareNodeQsIfNeeded(selected_path){
	var pkt_ongoing_tostr = pkt_ongoing.toString();
	for (var i = 0; i < selected_path.length; i++){
		if(pkt_ongoing_tostr.indexOf(selected_path[i]) < 0){
			pkt_nodes_master[selected_path[i]] = [];
			scheduleQPoll(selected_path[i]);
		} 
	}
		
}	


	
/**
 * Schedules node queue check for packet.
 * @param {string} node - The node.
 */
function scheduleQPoll(node){
	intervals["pkt_q_" + node] = eval(setInterval(function() { checkNodeQforPkt(node) }, 10));
}

	
	
/**
 * Times a packet transfer.
 * @param {string} pkt - The packet to be transferred.
 * @param {string} node - The node.
 */
function schedulePktTransfer(pkt, node){		
	var pkt_seq = Number(pkt.pkt_id.split("_")[1]) + 1;
	setTimeout(function(){ transferPktDataOnChnl(pkt, node) }, Number(pRDelay) * 1000);		
}
	

		
/**
 * Animates packet transfer on a link.
 * @param {object} pkt - The packet.
 * @param {string} node - The current position of packet with respect to node.
 */
function transferPktDataOnChnl(pkt, node){	
	var prev_chnl_id;		
	var pos_in_path = pkt.path.indexOf(node);		
	var cur_pkt_seqid = pkt.pkt_id.split("_")[1];
	var section = pkt.path.substring(pos_in_path, pos_in_path + 2);
	var prev_section = pos_in_path == 0 ? "0" : pkt.path.substring(pos_in_path - 1, pos_in_path + 1);
	var sdr = pkt.sdr;
	var rcvr = pkt.rcvr;
	var pkt_dets = pkt.overall_pkt_info;		
	var pkt_xfer_uniq_id = pkt.pkt_id + "_" + section.substring(0,1) + section.substring(1,2);
	var pkt_prev_xfer_uniq_id = pkt.pkt_id + "_" + prev_section;		
	if(prev_section != "0"){
		var prev_chnl_det = determineReqChnlDet(prev_section);
		var prev_chnl_elem = prev_chnl_det.elem;
		prev_chnl_id = prev_chnl_elem.getAttribute("id");
		document.getElementById("setend_cktanim_"  + pkt_prev_xfer_uniq_id + "_" + sdr + rcvr).setAttribute("to", 0);
	}		
	var finalLegFlag = false;
	if (section.substring(1,2) == rcvr){
		finalLegFlag = true;
	}	
	showAsBusyNode(document.getElementById("node_" + section.substring(0,1)));	
	var chnl_det = determineReqChnlDet(section);    
	var chnl_elem = chnl_det.elem;	
	var chnl_id = chnl_elem.getAttribute("id");											
	var chnl_x1 = chnl_det.x1;
	var chnl_y1 = chnl_det.y1;
	var chnl_x2 = chnl_det.x2;
	var chnl_y2 = chnl_det.y2;
	
	var chnl_angle = calculateAngleInDegrees(chnl_x1, chnl_y1, chnl_x2, chnl_y2);
	var chnl_dist = calculateDistance (chnl_x1, chnl_y1, chnl_x2, chnl_y2);
	
	var rect = document.createElementNS(svgnamespace, "rect");		
	rect.setAttribute("class", "databar_pkt");												
	rect.setAttribute("id", "databar_" + pkt_xfer_uniq_id + "_" + sdr + rcvr);
	rect.setAttribute("height", "4");
	rect.setAttribute("width", "40");   // TEST assumed to be 40
		
	var lastPacketFlag = cur_pkt_seqid == pkt_dets.pktCount - 1 ? true : false;
	var dur = 1;	//TEST default value		
	var movePktFromNodeQ_val = 0;
	var pkt_data_fill = sdrrcvr_fill_map[sdr + rcvr];
	
	//alert(3);
	var svg_encl = document.getElementById("full_enclosure_svg");	
	if(pkt_dets.partialPkt && cur_pkt_seqid == pkt_dets.pktCount - 1){
		//alert("0");
		createGradient(svg_encl,pkt_xfer_uniq_id,[
		  {offset:(100 - pkt_dets.partial_pkt_hdr_pc) + '%', 'stop-color':pkt_data_fill, 'stop-opacity':'1'},
		  {offset:pkt_dets.partial_pkt_hdr_pc + '%','stop-color':'red', 'stop-opacity':'1'}
		]);
		
		
		
		var stop5_grad = document.getElementById("stop5");
		stop5_grad.setAttribute("stop-color", pkt_data_fill);
		stop5_grad.setAttribute("offset", (100 - pkt_dets.partial_pkt_hdr_pc) + "%");
		var stop6_grad = document.getElementById("stop6");
		stop6_grad.setAttribute("offset", pkt_dets.partial_pkt_hdr_pc + "%");
		
		//rect.setAttribute("fill", "url(#switch_lingrad_partial)");	
		rect.setAttribute("fill", "url(#" + pkt_xfer_uniq_id + ")");
				
		partialFlag = true;
		var tDataInPacket = pMaxLen - pHeadLen;
		dur = ((pLength % tDataInPacket) + Number(pHeadLen))/pRate + Number(pTDelay);			
		movePktFromNodeQ_val = ((pLength % tDataInPacket) + Number(pHeadLen))/pRate;						
	} else {
		
		//alert("6");
		createGradient(svg_encl,pkt_xfer_uniq_id,[
		  {offset:(100 - pkt_dets.full_pkt_hdr_pc) + '%', 'stop-color':pkt_data_fill, 'stop-opacity':'1'},
		  {offset:pkt_dets.full_pkt_hdr_pc + '%','stop-color':'red', 'stop-opacity':'1'}
		]);
		//alert("7");
		/*
		var stop2_grad = document.getElementById("stop2");
		stop2_grad.setAttribute("stop-color", pkt_data_fill);
		stop2_grad.setAttribute("offset", (100 - pkt_dets.full_pkt_hdr_pc) + "%");
		var stop3_grad = document.getElementById("stop3");
		stop3_grad.setAttribute("offset", pkt_dets.full_pkt_hdr_pc + "%");
		*/
		
		
		//rect.setAttribute("fill", "url(#switch_lingrad_full)");
		rect.setAttribute("fill", "url(#" + pkt_xfer_uniq_id + ")");
		
		dur = Number(pMaxLen/pRate) + Number(pTDelay);			
		movePktFromNodeQ_val = Number(pMaxLen/pRate);
	}
	
	setTimeout(function(){ showAsAvailableNode([section.substring(0,1)]) }, Number(dur)*20000/Number(chnl_dist)) ;
	setTimeout(function(){ showAsBusyNode(document.getElementById("node_" + section.substring(1,2))) }, Number(dur)*1000 - Number(dur)*40000/Number(chnl_dist)) ;

	rect.setAttribute("transform", "rotate(" + chnl_angle + ")");
			
	var ani = document.createElementNS(svgnamespace,"animateMotion");
	ani.setAttribute("id", "cktanim_" + pkt_xfer_uniq_id + "_" + sdr + rcvr);
	ani.setAttribute("dur", dur + "s");  // TEST assumed to be 5s						
		
	//credit goes to https://stackoverflow.com/questions/12865888/getting-the-current-time-of-an-svganimation-element-in-svg-tiny-1-2
	var elapsedSincePgLoad = document.getElementById("full_enclosure_svg").getCurrentTime();
	ani.setAttribute("begin", elapsedSincePgLoad + "s");					
	ani.setAttribute("repeatCount", "1");
	ani.setAttribute("fill", "freeze");		

	var path = document.createElementNS(svgnamespace,"path");
	path.setAttribute("id", "dpath_" + sdr + rcvr + "_" + section);
	path.setAttribute("d", "M" + chnl_x1 + "," + chnl_y1 + " L" + chnl_x2 + "," + chnl_y2);
	path.setAttribute("stroke", "lightgrey");
	path.setAttribute("stroke-width", "0");
	path.setAttribute("fill", "none");

	var mpath = document.createElementNS(svgnamespace,"mpath");
	mpath.setAttribute("id", "mpath_" + sdr + rcvr + "_" + section);
	mpath.setAttributeNS('http://www.w3.org/1999/xlink','href',"#dpath_" + sdr + rcvr + "_" + section);

	var set_end = document.createElementNS(svgnamespace,"set");
	set_end.setAttribute("id", "setend_cktanim_"  + pkt_xfer_uniq_id + "_" + sdr + rcvr);
	set_end.setAttribute("attributeName", "width");  
	set_end.setAttribute("attributeType", "XML");
	set_end.setAttribute("to", "39");		
	set_end.setAttribute("begin", "cktanim_"  + pkt_xfer_uniq_id + "_" + sdr + rcvr + ".end");
			
	document.getElementById("full_enclosure_svg").appendChild(path);
	ani.appendChild(mpath);
	rect.appendChild(ani);
	rect.appendChild(set_end);

	document.getElementById("full_enclosure_svg").appendChild(rect);
						
	var thispkt_path = pkt.path;
	var index_prev_node = thispkt_path.indexOf(pkt_xfer_uniq_id.substring(pkt_xfer_uniq_id.length - 2, pkt_xfer_uniq_id.length - 1));		
	if(finalLegFlag){
		setTimeout(function(){ movePktFromNodeQ(pkt, pkt_xfer_uniq_id.substring(pkt_xfer_uniq_id.length - 2, pkt_xfer_uniq_id.length - 1), "0"); }, Number(movePktFromNodeQ_val) * 1000);
	} else {
		setTimeout(function(){ movePktFromNodeQ(pkt, thispkt_path.substring(index_prev_node, index_prev_node + 1), thispkt_path.substring(index_prev_node + 1, index_prev_node + 2)); }, Number(movePktFromNodeQ_val) * 1000);
	}			
	intervals[pkt_xfer_uniq_id] = eval(setInterval(function() { checkPktXferComplete(pkt_xfer_uniq_id, pkt, lastPacketFlag, finalLegFlag, chnl_id, sdr, rcvr)  }, 10));	
}
	


/**
 * Creates a linear gradient for packet's data-header colour fills.
 * @param {element} svg - The svg element under which the linear gradient will be created.
 * @param {string} id - The id attribute of the to-be linear gradient.
 * @param {object} stops - The object containing stop element attributes of the to-be linear gradient.
 */
/* credited to http://jsfiddle.net/nra29/2/	*/
function createGradient(svg,id,stops){
	var grad  = document.createElementNS(svgnamespace,'linearGradient');
	grad.setAttribute('id',id);
	for (var i=0;i<stops.length;i++){
		var attrs = stops[i];
		var stop = document.createElementNS(svgnamespace,'stop');
		for (var attr in attrs){
			if (attrs.hasOwnProperty(attr)){
				stop.setAttribute(attr,attrs[attr]);
			} 
		}
		grad.appendChild(stop);
	}
	var defs = svg.querySelector('defs') ||
	svg.insertBefore( document.createElementNS(svgnamespace,'defs'), svg.firstChild);
	return defs.appendChild(grad);
}



/**
 * Checks if packet transfer is complete and if so, initiates follow-up actions
 * @param {string} pkt_xfer_uniq_id - Packet identifier.
 * @param {object} pkt - The packet.
 * @param {string} lastPacketFlag - Identifies if packet is the last for a sender-receiver pair.
 * @param {string} finalLegFlag - Identifies if current link is the last leg for the packet. 
 * @param {string} chnl_id - The link identifier.
 * @param {string} sdr - The original sender of packet.
 * @param {string} rcvr - The final destination for the packet.  
 */
function checkPktXferComplete(pkt_xfer_uniq_id, pkt, lastPacketFlag, finalLegFlag, chnl_id, sdr, rcvr){
	var active_msg_length = document.getElementById("databar_" + pkt_xfer_uniq_id + "_" + sdr + rcvr).getAttribute("width");
	if (active_msg_length == 39) {		
		var thispkt_path = pkt.path;
		var index_prev_node = thispkt_path.indexOf(pkt_xfer_uniq_id.substring(pkt_xfer_uniq_id.length - 2, pkt_xfer_uniq_id.length - 1));
		showAsAvailableNode([pkt_xfer_uniq_id.substring(pkt_xfer_uniq_id.length - 1, pkt_xfer_uniq_id.length)])	;						
		if(finalLegFlag){
			var now_time_1 = document.getElementById("full_enclosure_svg").getCurrentTime();
			document.getElementById("setend_cktanim_"  + pkt_xfer_uniq_id + "_" + sdr + rcvr).setAttribute("to", 0);
			document.getElementById("setend_cktanim_"  + pkt_xfer_uniq_id + "_" + sdr + rcvr).setAttribute("begin", now_time_1 + "s");	
		}						
		if(lastPacketFlag && finalLegFlag){
			var anim_paths = setupVCPkt(thispkt_path);
			animateCktSetupAndDisconnect(anim_paths.anim_path_fwd, 1);				
			endedCount++;
			var timetaken_elem = document.getElementById("timetaken_" + endedCount);
			timetaken_elem.textContent = sdr + " to " + rcvr + " time taken:  " + (document.getElementById("full_enclosure_svg").getCurrentTime() - clockStartTime).toPrecision(6) + " s";
			timetaken_elem.setAttribute("fill-opacity", "1");
		}
		clearInterval(intervals[pkt_xfer_uniq_id]);
		intervals[pkt_xfer_uniq_id] = -1;
			
	}
}
	


/**
 * Sets up a Virtual Circuit packet by calculating the animation paths.
 * @returns Two-way animation path and 
 * @param {string} path_pkt - The path to be followed the packet.
 */
function setupVCPkt(path_pkt){		
	var anim_path = "";
	var assoc_nodes = [];
	for (var i = 0; i < path_pkt.length; i++){
		assoc_nodes.push(path_pkt.substring(i,i+1));
		var circ = document.getElementById("node_" + path_pkt.substring(i,i+1));
		var xPos = circ.getAttribute("cx");
		var yPos = circ.getAttribute("cy");
		anim_path = i == 0 ? anim_path + "M" + xPos + "," + yPos : anim_path + " L" + xPos + "," + yPos;							
	}
	var anim_path_fwd = anim_path;
	for (var j = path_pkt.length - 1; j > 0 ; j--){
		var circ_rev = document.getElementById("node_" + path_pkt.substring(j-1,j));
		var xPos_rev = circ_rev.getAttribute("cx");
		var yPos_rev = circ_rev.getAttribute("cy");
		anim_path = anim_path + " L" + xPos_rev + "," + yPos_rev;
	}
	return {anim_path_roundtrip:anim_path, anim_path_fwd:anim_path_fwd}; 	//0 denotes setup								
}
	


/**
 * Animates the animation of ping and setup.
 * @param {string} anim_path - The path to be followed for the ping.
 * @param {string} mode - The mode which signifies setup or disconnection.
 */
function animatePktSetupAndDisconnect (anim_path, mode) {		
	var init = anim_path.substring(1, anim_path.length).split(" ")[0];
	var x = init.split(",")[0];
	var y = init.split(",")[1];
	var path_wo_chars = replaceAll(replaceAll(anim_path,",","Y")," ","");
	var dur = cDisconnTime;
		
	var connsig_circ = document.createElementNS(svgnamespace, "circle");														
	connsig_circ.setAttribute("id", "cktconnsig_" + mode + path_wo_chars); 
	connsig_circ.setAttribute("r", "3");	// TEST assumed to be 3
	mode == 0 ? eval(connsig_circ.setAttribute("style", "stroke: none; fill: #0000ff;")) : eval(connsig_circ.setAttribute("style", "stroke: none; fill: red;")); 
			
	var ani = document.createElementNS(svgnamespace,"animateMotion");
	ani.setAttribute("id", "cktconnsig_anim_" + mode + path_wo_chars);
	ani.setAttribute("dur", dur);  
	//credit goes to https://stackoverflow.com/questions/12865888/getting-the-current-time-of-an-svganimation-element-in-svg-tiny-1-2
	var elapsedSincePgLoad = document.getElementById("full_enclosure_svg").getCurrentTime();
	ani.setAttribute("begin", elapsedSincePgLoad + "s");						
	ani.setAttribute("repeatCount", "1");
	ani.setAttribute("fill", "remove");

	var path = document.createElementNS(svgnamespace,"path");
	path.setAttribute("id", "dpath_" + mode + path_wo_chars);
	path.setAttribute("d", anim_path);
	path.setAttribute("stroke", "lightgrey");
	path.setAttribute("stroke-width", "0");
	path.setAttribute("fill", "none");

	var mpath = document.createElementNS(svgnamespace,"mpath");
	mpath.setAttribute("id", "mpath_" + mode + path_wo_chars);
	mpath.setAttributeNS('http://www.w3.org/1999/xlink','href',"#dpath_"  + mode + path_wo_chars);

	var set_end = document.createElementNS(svgnamespace,"set");
	set_end.setAttribute("id", "setend_cktanim_" + mode + path_wo_chars);
	set_end.setAttribute("attributeName", "r");  
	set_end.setAttribute("attributeType", "XML");
	set_end.setAttribute("to", "0");
	set_end.setAttribute("begin", "cktconnsig_anim_" + mode + path_wo_chars + ".end");
			
	document.getElementById("full_enclosure_svg").appendChild(path);
	ani.appendChild(mpath);
	connsig_circ.appendChild(ani);
	connsig_circ.appendChild(set_end);
	document.getElementById("full_enclosure_svg").appendChild(connsig_circ);
}
	


/**
 * Calculates the important stats related to packets, e.g. count, partialpacket presence etc..
 * @returns (object) Important packet-related details
 */		
function calculatePktStats() {		
	var partialPktFlag = false;	
	var tDataInPacket = pMaxLen - pHeadLen;
	// calculations referred from class notes and earlier utility
	//bitwise OR operator to handle NaN or infinite case 
	var tNumberOfPackets = ((pLength / tDataInPacket | 0));		
	if (pLength % tDataInPacket > 0) {
		tNumberOfPackets++;
		partialPktFlag =	true;
	}
	
	var pkt_count_txt = document.getElementById("pkt_count_txt");
	pkt_count_txt.textContent = "Packet count:   " + tNumberOfPackets;
	pkt_count_txt.setAttribute("fill-opacity", "1");
	var part_pkt_txt = document.getElementById("part_pkt_txt");
	if(partialPktFlag){
		part_pkt_txt.textContent = "Partial packet present?:  Yes (" + (pLength % tDataInPacket) + " data bits)";
	}
	else{
		part_pkt_txt.textContent = "Partial packet present?:  No";
	}
	part_pkt_txt.setAttribute("fill-opacity", "1");
			
	var tPacketTransmissionTime = (pMaxLen / pRate) * 1000;
	var tTotalTime = (pTDelay + pRDelay + (((pLength / (tDataInPacket) | 0)) | 0) * (pRDelay + (pMaxLen / pRate)) + ((pLength % tDataInPacket) + pHeadLen) / pRate) * 1000;
	//bar length in animation corresponding to packet max length assumed to be 50 
	var pktBarLength = 50; //TEST assumed to be 50
	var hdr_pkt_percent = (pHeadLen / (pMaxLen)) * 100;
	var hdr_pkt_percent_last = (pHeadLen / ((pLength % tDataInPacket) + Number(pHeadLen))) * 100;

	return {pktlength:pktBarLength,pktCount:tNumberOfPackets,full_pkt_hdr_pc:hdr_pkt_percent,partial_pkt_hdr_pc:hdr_pkt_percent_last,partialPkt:partialPktFlag,pktXmissionTime:tPacketTransmissionTime}
}
	

	
/**
 * Examines circuit sender-receiver pairs, determines path.
 */	
function prepareCircuitSw(){		
	clockStartTime = document.getElementById("full_enclosure_svg").getCurrentTime();
	var data_rect_fills_tmp = data_rect_fills.slice();					
	for (var i = 0; i < sdr_rcvr_pairs.length; i++){			
		var cur_sdr_pair = sdr_rcvr_pairs[i];
		var sdr = cur_sdr_pair.substring(0,1);
		var rcvr = cur_sdr_pair.substring(1,2);						
		determinePaths(sdr, rcvr);			
		var stored_paths = paths[sdr + rcvr];
		var rand_num = Math.floor(Math.random() * stored_paths.length);
		var selected_path = stored_paths[rand_num];
		pathsfound = [];
		visited = [];
		sdrrcvr_fill_map[cur_sdr_pair] = data_rect_fills_tmp.shift();
		checkPathBlockability(selected_path, sdr, rcvr);									
	}
}
	


/**
 * Checks if any of the node in the required path is currently busy.
 * @returns (boolean) Flag that indicates if the path is blocked.
 * @param {string} selected_path - The path selected.
 */	
function isSelectedPathBlocked(selected_path){
	var blockFlag = false;
	if (ckt_ongoing.length > 0){
		for (var i = 0; i < selected_path.length - 1; i++){
			var needed_node = selected_path.substring(i,i+1);
			for (var j = 0; j < ckt_ongoing.length; j++){
				if(ckt_ongoing[j].indexOf(needed_node) >=0) {
					blockFlag = true;
					break;
				}
			}
			if (blockFlag){
				break;
			}
		}
	}
	return blockFlag;	
}


	
/**
 * If path is blackable, inititates the data transfer.
 * @param {string} selected_path - The path selected. 
 * @param {string} sdr - The original sender of the data.
 * @param {string} rcvr - The intended final receiver of the data.
 */
function checkPathBlockability(selected_path, sdr, rcvr){	
	if(!(isSelectedPathBlocked(selected_path))){
		setupCkt(selected_path, sdr, rcvr);								
		//populate ongoing/polling queue
		ckt_ongoing.push(selected_path);	
		if (intervals[selected_path]  > 0){
			clearInterval(intervals[selected_path]);
			intervals[selected_path] = -1;
		}			
	} else {
		if (!(intervals[selected_path]  > 0)){
			intervals[selected_path] = eval(setInterval(function() { checkPathBlockability(selected_path, sdr, rcvr) }, 20));
		}							
	}	
}
	
	
	
/**
 * Calls the function which searches possible paths between a sender and a receiver.
 * @param {string} sdr - The original sender of the data.
 * @param {string} rcvr - The intended final receiver of the data.
 */	
function determinePaths (sdr, rcvr){
	paths[sdr + rcvr] = [];
	findpath(sdr, rcvr);		
}


	
/**
 * Recursive function which finds possible paths between a sender and a receiver.
 * @param {string} sdr - The sender.
 * @param {string} rcvr - The receiver.
 */
function findpath(currsource, dest){
	var lastvisited = currsource.substring(currsource.length -1, currsource.length);
	if(visited.indexOf(lastvisited) < 0){
		visited.push (lastvisited);
		for (var j = 0; j < adjNodeObj[lastvisited].length; j++){
			var curr_node1 = adjNodeObj[lastvisited][j];
			if(visited.indexOf(curr_node1) < 0){
				pathsfound.push (currsource + curr_node1);
				if (dest != curr_node1){
					var currsource1 = currsource + curr_node1;
					findpath (currsource1,dest);
				}
			}
		} 		
	}		
	for (var i = 0; i < pathsfound.length; i++){
		var temp_path = pathsfound[i];
		var temp_path_nodecount = temp_path.length;
		if (temp_path.substring(0,1) == currsource && temp_path.substring(temp_path_nodecount -1, temp_path_nodecount) == dest){
			paths[lastvisited.substring(0,1) + dest].push(pathsfound[i]);
		}
	}
		
}
	


/**
 * Starts data transfer for the circuit.
 * @param {string} path_ckt - The path for the circuit.
 * @param {string} sdr - The sender.
 * @param {string} rcvr - The receiver.
 * @param {string} anim_path_fwd - The one-way forward sender-to-destination animation path.
 * @param {string} assoc_nodes - The associated nodes.
 */	
function animateCircuitSw(path_ckt, sdr, rcvr, anim_path_fwd, assoc_nodes){
	for (var i = 0; i < path_ckt.length - 1; i++){
		var section = path_ckt.substring(i,i+2);
		var prev_section = i == 0 ? "0" : path_ckt.substring(i-1,i+1);			
		var chnl_det = determineReqChnlDet(section);
		if (!chnl_det.busy){
			transferDataOnChnl(section, prev_section, sdr, rcvr, anim_path_fwd, assoc_nodes);
		} else {
			var chnl_id = chnl_det.id;
			intervals[chnl_id] = eval(setInterval(function() { pollChnlAvailability(section, prev_section, chnl_id, sdr, rcvr, anim_path_fwd, assoc_nodes) }, 10));
		}
	}
}
	
	

/**
 * Sets up a Circuit after calculating the animation paths.
 * @param {string} path_ckt - The path to be followed in the circuit.
 * @param {string} sdr - The sender.
 * @param {string} rcvr - The receiver.
 */	
function setupCkt(path_ckt, sdr, rcvr){
	var anim_path = "";
	var assoc_nodes = [];
	for (var i = 0; i < path_ckt.length; i++){
		assoc_nodes.push(path_ckt.substring(i,i+1));
		var circ = document.getElementById("node_" + path_ckt.substring(i,i+1));
		var xPos = circ.getAttribute("cx");
		var yPos = circ.getAttribute("cy");
		anim_path = i == 0 ? anim_path + "M" + xPos + "," + yPos : anim_path + " L" + xPos + "," + yPos;
		showAsBusyNode(circ);			
	}
	var anim_path_fwd = anim_path;
	for (var j = path_ckt.length - 1; j > 0 ; j--){
		var circ_rev = document.getElementById("node_" + path_ckt.substring(j-1,j));
		var xPos_rev = circ_rev.getAttribute("cx");
		var yPos_rev = circ_rev.getAttribute("cy");
		anim_path = anim_path + " L" + xPos_rev + "," + yPos_rev;
	}
	animateCktSetupAndDisconnect(anim_path, 0);	//0 denotes setup
	if (sw_mode == "C"){
		animateCircuitSw(path_ckt, sdr, rcvr, anim_path_fwd, assoc_nodes);
	}								
}
	


/**
 * Fills the node to signify it is busy handling message.
 * @param {Element} circ - The node being targeted.
 */		
function showAsBusyNode(circ){
	sw_mode == "C" ? eval(setTimeout(function(){circ.setAttribute("fill", "yellow")}, cSetupTime*1000)) : eval(circ.setAttribute("fill", "yellow"));
}
		
		
		
/**
 * Fills the nodes to signify they are available.
 * @param {Array} assoc_nodes - The nodes being targeted.
 */				
function showAsAvailableNode(assoc_nodes){
	for (var i = 0; i < assoc_nodes.length; i++){
		var cur_node = document.getElementById("node_" + assoc_nodes[i]);
		cur_node.setAttribute("fill", "grey");
	}
}
	
	
	
/**
 * Utility function to replace all occurrences of a pattern with another string.
 * @param {string} str - The string upon which search is done.
 * @param {string} find - The searched string.
 * @param {string} replace - The string which replaces the searched string.
 */	
//credit goes to https://stackoverflow.com/questions/1144783/how-to-replace-all-occurrences-of-a-string-in-javascript
function replaceAll(str, find, replace) {
	return str.replace(new RegExp(find, 'g'), replace);
}



/**
 * Animates the animation of ping and setup.
 * @param {string} anim_path - The path to be followed for the ping.
 * @param {string} mode - The mode which signifies setup or disconnection.
 */	
function animateCktSetupAndDisconnect (anim_path, mode) {
	var init = anim_path.substring(1, anim_path.length).split(" ")[0];
	var x = init.split(",")[0];
	var y = init.split(",")[1];
	var path_wo_chars = replaceAll(replaceAll(anim_path,",","Y")," ","");
	var dur = mode == 0 ? cSetupTime : cDisconnTime; //disconnect time assumed 0.25
		
	var connsig_circ = document.createElementNS(svgnamespace, "circle");	
	connsig_circ.setAttribute("class", "cktconnsig");													
	connsig_circ.setAttribute("id", "cktconnsig_" + mode + path_wo_chars);  
	connsig_circ.setAttribute("r", "3");	//  assumed to be 3
			
	if (mode == 0){
		connsig_circ.setAttribute("style", "stroke: none; fill: #0000ff;");
	} else if (mode == 1){
		connsig_circ.setAttribute("style", "stroke: none; fill: red;");
	}

	var ani = document.createElementNS(svgnamespace,"animateMotion");
	ani.setAttribute("class", "cktconnsig_anim");	
	ani.setAttribute("id", "cktconnsig_anim_" + mode + path_wo_chars);
	ani.setAttribute("dur", dur);  
	//credit goes to https://stackoverflow.com/questions/12865888/getting-the-current-time-of-an-svganimation-element-in-svg-tiny-1-2
	var elapsedSincePgLoad = document.getElementById("full_enclosure_svg").getCurrentTime();
	ani.setAttribute("begin", elapsedSincePgLoad + "s");						
	ani.setAttribute("repeatCount", "1");
	ani.setAttribute("fill", "remove");

	var path = document.createElementNS(svgnamespace,"path");
	path.setAttribute("class", "cktconnsig_dpath");
	path.setAttribute("id", "dpath_" + mode + path_wo_chars);
	path.setAttribute("d", anim_path);
	path.setAttribute("stroke", "lightgrey");
	path.setAttribute("stroke-width", "0");
	path.setAttribute("fill", "none");

	var mpath = document.createElementNS(svgnamespace,"mpath");
	mpath.setAttribute("class", "cktconnsig_mpath");
	mpath.setAttribute("id", "mpath_" + mode + path_wo_chars);
	mpath.setAttributeNS('http://www.w3.org/1999/xlink','href',"#dpath_"  + mode + path_wo_chars);

	var set_end = document.createElementNS(svgnamespace,"set");
	set_end.setAttribute("class", "cktconnsig_setend");
	set_end.setAttribute("id", "setend_cktanim_" + mode + path_wo_chars);
	set_end.setAttribute("attributeName", "r");  
	set_end.setAttribute("attributeType", "XML");
	set_end.setAttribute("to", "0");
	set_end.setAttribute("begin", "cktconnsig_anim_" + mode + path_wo_chars + ".end");
			
	document.getElementById("full_enclosure_svg").appendChild(path);
	ani.appendChild(mpath);
	connsig_circ.appendChild(ani);
	connsig_circ.appendChild(set_end);
	document.getElementById("full_enclosure_svg").appendChild(connsig_circ);
}
	


/**
 * Periodically scheduled function that checks for blockability of node.
 * @param {string} section - The current link (needed for called function).
 * @param {string} prev_section - The previous link in the path (needed for called function).
 * @param {string} chnl_id - The link identifier.
 * @param {string} sdr - The sender.
 * @param {string} rcvr - The receiver.
 * @param {string} anim_path_fwd - The sender-to-destination animation path.
 * @param {string} assoc_nodes - The associated nodes in the path.   
 */	
function pollChnlAvailability(section, prev_section, chnl_id, sdr, rcvr, anim_path_fwd, assoc_nodes){
	if (!isSectionOfPathBusy(section)){
		transferDataOnChnl(section, prev_section, sdr, rcvr, anim_path_fwd, assoc_nodes);
		clearInterval(intervals[chnl_id]);
		intervals[chnl_id] = -1;
	}
}



/**
 * Calls the utility function to tell the calling function if a link is busy.
 * @param {string} section - The current link (needed for called function).
 */	
function isSectionOfPathBusy(section) {
	var chnl_det = determineReqChnlDet(section);
	return chnl_det.busy;
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
 * Clears output area and reinitializes.
 */
function prepOutputArea(){
	endedCount = 0; /* reinitialise for re-runs */
	document.getElementById("stats_boundary").setAttribute("style", "stroke:#000000;");
	document.getElementById("stats_title").setAttribute("fill-opacity", "1");
	for (var i=1; i<limitOfNodes; i++){
		document.getElementById("timetaken_" + i).setAttribute("fill-opacity", "0");
	}
}
	
	
	
/**
 * Animates circuit data transfer on a link.
 * @param {string} section - The current link (needed for called function).
 * @param {string} prev_section - The previous link in the path (needed for called function).
 * @param {string} sdr - The sender.
 * @param {string} rcvr - The receiver.
 * @param {string} anim_path_fwd - The sender-to-destination animation path.
 * @param {string} assoc_nodes - The associated nodes in the path.  
 */		
function transferDataOnChnl(section, prev_section, sdr, rcvr, anim_path_fwd, assoc_nodes, cur_pkt_colour){
	var hop_count = assoc_nodes.length - 1;
	var anim_dur = pLength/(pRate * hop_count) + Number(pTDelay)/hop_count;
	var prev_chnl_id;
	if(prev_section != "0"){
		var prev_chnl_det = determineReqChnlDet(prev_section);
		var prev_chnl_elem = prev_chnl_det.elem;
		prev_chnl_id = prev_chnl_elem.getAttribute("id");
	}
	var chnl_det = determineReqChnlDet(section);    
	var chnl_elem = chnl_det.elem;	
	var chnl_id = chnl_elem.getAttribute("id");			
	var chnl_x1 = chnl_det.x1;
	var chnl_y1 = chnl_det.y1;
	var chnl_x2 = chnl_det.x2;
	var chnl_y2 = chnl_det.y2;			
	var chnl_angle = calculateAngleInDegrees(chnl_x1, chnl_y1, chnl_x2, chnl_y2);
	var chnl_dist = calculateDistance (chnl_x1, chnl_y1, chnl_x2, chnl_y2);
	
	var rect = document.createElementNS(svgnamespace, "rect");
	rect.setAttribute("class", "rect_msg");														
	rect.setAttribute("id", "databar_" + sdr + rcvr + "_" + chnl_id);
	rect.setAttribute("height", "4");
	rect.setAttribute("width", "40");   //  assumed to be 40
	rect.setAttribute("fill", sdrrcvr_fill_map[sdr + rcvr]);
	
	rect.setAttribute("fill-opacity", "0");
	rect.setAttribute("transform", "rotate(" + chnl_angle + ")");
			
	var ani = document.createElementNS(svgnamespace,"animateMotion");
	ani.setAttribute("class", "rect_msg_anim");	
	ani.setAttribute("id", "cktanim_" + sdr + rcvr + "_" + chnl_id);
	ani.setAttribute("dur", anim_dur + "s");			
	if (prev_section == "0"){
		//credit goes to https://stackoverflow.com/questions/12865888/getting-the-current-time-of-an-svganimation-element-in-svg-tiny-1-2
		var elapsedSincePgLoad = document.getElementById("full_enclosure_svg").getCurrentTime();
		ani.setAttribute("begin", (Number(cSetupTime) + Number(elapsedSincePgLoad)) + "s");
	} else {
		ani.setAttribute("begin", "cktanim_" + sdr + rcvr + "_" + prev_chnl_id + ".end");
	}						
	ani.setAttribute("repeatCount", "1");
	ani.setAttribute("fill", "freeze");

	var path = document.createElementNS(svgnamespace,"path");
	path.setAttribute("class", "rect_msg_dpath");
	path.setAttribute("id", "dpath_" + sdr + rcvr + "_" + chnl_id);			
	path.setAttribute("d", "M" + chnl_x1 + "," + chnl_y1 + " L" + chnl_x2 + "," + chnl_y2);			
	path.setAttribute("stroke", "lightgrey");
	path.setAttribute("stroke-width", "0");
	path.setAttribute("fill", "none");

	var mpath = document.createElementNS(svgnamespace,"mpath");
	mpath.setAttribute("class", "rect_msg_mpath");
	mpath.setAttribute("id", "mpath_" + sdr + rcvr + "_" + chnl_id);
	mpath.setAttributeNS('http://www.w3.org/1999/xlink','href',"#dpath_" + sdr + rcvr + "_" + chnl_id);

	var set_end = document.createElementNS(svgnamespace,"set");
	set_end.setAttribute("class", "rect_msg_setend");
	set_end.setAttribute("id", "setend_cktanim_" + sdr + rcvr + "_" + chnl_id);
	set_end.setAttribute("attributeName", "width");  
	set_end.setAttribute("attributeType", "XML");
	set_end.setAttribute("to", "0");			
	set_end.setAttribute("begin", "cktanim_" + sdr + rcvr + "_" + chnl_id + ".end");
		
	var set_color = document.createElementNS(svgnamespace,"set");
	set_color.setAttribute("class", "rect_msg_setcolor");
	set_color.setAttribute("id", "setcolor_cktanim_" + sdr + rcvr + "_" + chnl_id);
	set_color.setAttribute("attributeName", "fill-opacity");  
	set_color.setAttribute("attributeType", "XML");
	set_color.setAttribute("to", "1");
	set_color.setAttribute("begin", "cktanim_" + sdr + rcvr + "_" + chnl_id + ".begin");							
			
	document.getElementById("full_enclosure_svg").appendChild(path);
	ani.appendChild(mpath);
	rect.appendChild(ani);
	rect.appendChild(set_end);
	rect.appendChild(set_color);
	document.getElementById("full_enclosure_svg").appendChild(rect);

	if (section.substring(1,2) == rcvr){
		var block_interval_val = "blockind_" + sdr + rcvr;
		intervals[block_interval_val] = eval(setInterval(function() { checkCommComplete(block_interval_val, chnl_id, sdr, rcvr, anim_path_fwd, assoc_nodes) }, 10));
	}		
}
	
	
		
/**
 * Periodically scheduled function that checks for data transfer completion.
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
		animateCktSetupAndDisconnect(anim_path_fwd, 1);
		updateActivePathList(sdr, rcvr);
		clearInterval(intervals[block_interval_val]);
		intervals[block_interval_val] = -1;
		endedCount++;
		var timetaken_elem = document.getElementById("timetaken_" + endedCount);
		timetaken_elem.textContent = sdr + " to " + rcvr + " completed after:  " + (document.getElementById("full_enclosure_svg").getCurrentTime() - clockStartTime).toPrecision(6) + " s";
		timetaken_elem.setAttribute("fill-opacity", "1");
	}
}
	

	
/**
 * Updates the active circuit ongoing list by removing completed one.
 * @param {string} sdr - The original sender of the data unit.
 * @param {string} rcvr - The final destination for the data unit. 
 */	
function updateActivePathList(sdr, rcvr){
	for (var j = 0; j < ckt_ongoing.length; j++){
		var path_length = ckt_ongoing[j].length;
		if(ckt_ongoing[j].substring(0,1) == sdr && ckt_ongoing[j].substring(path_length-1, path_length) == rcvr) {			
			var tmp_var = ckt_ongoing[j];
			ckt_ongoing[j] = ckt_ongoing[0];
			ckt_ongoing[0] = tmp_var;
			break;
		}
	}
	ckt_ongoing.shift();	
}


	
/**
 * Initialises variables and removes animation elements in the scenario of user retry without page reload.
 * @param {string} stage - The stage at which function is called.
 * @param {Array} tobeDelItems - The animation items to be removed from page.
 */	  
 /* credit to https://stackoverflow.com/questions/10842471/remove-all-elements-of-a-certain-class-with-javascript for remove element code snippet */
function removeAnimElements(stage, tobeDelItems){
	for (var i = 0; i < tobeDelItems.length; i++){
		var elems_tobe_del = document.getElementsByClassName(tobeDelItems[i]);
		while(elems_tobe_del[0]) {
			elems_tobe_del[0].parentNode.removeChild(elems_tobe_del[0]);
		}
	}
	if (stage == "end"){
		paths = {};
		sdr_rcvr_pairs = [];
		ckt_ongoing = [];
		pkt_ongoing = [];
		pathsfound = [];
		visited = [];	
		pkt_nodes_master = {};
	}	
}
		


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
		chnlFinalPos = [clickxPos, clickyPos, clickNode];
		chnlClickFlg = false;
		drawChannel (chnlInitPos[0], chnlInitPos[1], chnlInitPos[2], chnlFinalPos[0], chnlFinalPos[1], chnlFinalPos[2]);
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

}
	


/**
 * Calculates distance between two nodes.
 * @returns calculated distance
 * @param {string} init_x - x coordinate of start node.
 * @param {string} init_y - y coordinate of end node.
 * @param {string} final_x - x coordinate of end node.
 * @param {string} final_y - y coordinate of end node. 
 */
 /* calculation referred from codeopen - "https://codepen.io/daveboling/pen/jWOorz" */
function calculateDistance (init_x, init_y, final_x, final_y){
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
 /* calculation referred from codeopen - "https://codepen.io/netsi1964/pen/WrRGoo" */
function calculateAngleInDegrees(init_x, init_y, final_x, final_y) {
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