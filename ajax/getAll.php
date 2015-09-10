<?php

header('Content-Type: application/json');

/*
Return Get all n3 files(-names) (without history files) from ../data/
*/

$files = array();

if ($handle = opendir('../data/')) {

    while (false !== ($file = readdir($handle))) {
    	if ( $file != "." && $file != ".." && preg_match('/\D\.n3$/', $file) ) {
    		$name = substr($file,  0, strripos($file, ".") );
        	array_push($files, $name);
        }
    }
    closedir($handle);
}

sort($files);

echo json_encode( array('result' => $files) );	

?>