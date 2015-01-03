<?php

header('Content-Type: application/json');


$fileId = isset( $_POST['name'] ) ? $_POST['name'] : false;
$voc = isset( $_POST['voc'] ) ? $_POST['voc'] : false;
$layout = isset( $_POST['layout'] ) ? $_POST['layout'] : false;


if ( $fileId && $voc && $layout ) {

	$fileId = addslashes($fileId);
	$time = time();

	if ( ! is_writable("../data") ) {
		echo json_encode( array('result' => false, 'msg' => 'Data-Folder not writeable') );
		exit;
	}

	// backup old vocabulary
	$filename = $fileId . ".n3";
	if ( file_exists("../data/" . $filename) ) {
		if ( ! rename( "../data/" . $filename , "../data/" . $fileId . "-" . $time . ".n3" ) ) {
			echo json_encode( array('result' => false, 'msg' => 'Cannot backup file "'.$fileId.'.n3"') );
			exit;
		}
	}	

	// write vocabulary	
	$filename = $fileId . ".n3";
	if (!$handle = fopen( "../data/" . $filename, "w")) {
		echo json_encode( array('result' => false, 'msg' => 'Cannot create file "'.$filename.'"') );
		exit;
	}

	if (!fwrite($handle, $voc)) {
		echo json_encode( array('result' => false, 'msg' => 'Cannot write file "'.$filename.'"') );
		exit;
	}

	// backup old layout	
	$filename = $fileId . ".json";
	if ( file_exists("../data/" . $filename) ) {		
		if ( ! rename( "../data/" . $filename , "../data/" . $fileId . "-" . $time . ".json" ) ) {
			echo json_encode( array('result' => false, 'msg' => 'Cannot backup file "'.$fileId.'.json"') );
			exit;
		}
	}

	// write graph layout
	$filename = $fileId . ".json";
	if (!$handle = fopen( "../data/" . $filename, "w")) {
		echo json_encode( array('result' => false, 'msg' => 'Cannot create file "'.$filename.'"') );
		exit;
	}

	if (!fwrite($handle, $layout)) {
		echo json_encode( array('result' => false, 'msg' => 'Cannot write file "'.$filename.'"') );
		exit;
	}

	// write log
	$filename = "log-" . $fileId . ".txt";
	if (!$handle = fopen( "../data/" . $filename, "a")) {
		echo json_encode( array('result' => false, 'msg' => 'Cannot open logfile') );
		exit;
	}

	if (!fwrite($handle, $time . " " . $fileId . "\n")) {
		echo json_encode( array('result' => false, 'msg' => 'Cannot write logfile') );
		exit;
	}


	echo json_encode( array('result' => true, 'msg' => 'Saved graph "' . $fileId . '"') );
	fclose($handle);

} else {
	echo json_encode( array('result' => false, 'msg' => 'Error: No filename or content to write...') );
}



?>