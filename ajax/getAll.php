<?php

header('Content-Type: application/json');

/*
Return Get all n3 files(-names) (without history files) from ../data/
*/

$files = array();

if ($handle = opendir('../data/')) {

    while (false !== ($file = readdir($handle))) {
    	if ( $file != "." && $file != ".." && preg_match('/\.n3$/', $file) ) {
    		$name = substr($file,  0, strripos($file, ".") );
        	array_push($files, $name);
        }
    }
    closedir($handle);    
}

//var_dump($files);

// cut the log-timestamp from end of filename
function removelogs($name) {
	if ( strrpos($name, "-") != false ) {
		return substr($name, 0, strripos($name, "-") );
	} else {
		return $name;
	}
}
$files = array_map("removelogs", $files);

$files = array_unique($files);

sort($files);

echo json_encode( array('result' => $files) );	

?>