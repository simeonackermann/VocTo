<?php

header('Content-Type: application/json');

$filename = isset( $_POST['name'] ) ? $_POST['name'] : false;
$content = "";

if ( $filename ) {

	$filename = addslashes($filename);

	if( file_exists("../data/" . $filename) ) {

		$content = file_get_contents("../data/" . $filename);

		preg_match( '/^@base.*<(.*)>.*\n/', $content, $base );
		if ( sizeof( $base ) > 0 ) {
			$base = $base[1];
		}
		preg_match_all( '/@prefix\s(.*):\s<(.*)>.*\n/', $content, $prefixes0, PREG_SET_ORDER );
		$prefixes = [];
		foreach ( $prefixes0 as $prefix ) {
			$prefixes[ $prefix[1] ] = $prefix[2];
		}
		$content = preg_replace( '/^@.*\n/m', '', $content );	

		echo json_encode( array('result' => true, 'base' => $base, 'prefixes' => $prefixes, 'content' => $content) );

	} else {
		echo json_encode( array('result' => false, 'msg' => 'File "'.$filename.'" not found') );	
	}

} else {
	echo json_encode( array('result' => false, 'msg' => 'No name given') );
}
?>
