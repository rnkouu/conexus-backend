;<?php exit; // DO NOT DELETE ?>
; OJS Configuration File

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; Database Configuration
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
[database]
driver = pgsql
host = db
username = ojs_user
password = ojs_password_change_me
name = ojs_db
port = 5432

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; General Configuration
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
[general]
installed = On
base_url = http://localhost:8080
enable_beacon = Off
session_check_ip = Off

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; File Configuration
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
[files]
public_files_dir = /var/www/html/public
private_files_dir = /var/www/html/private
tmp_dir = /var/www/html/tmp

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; Security Configuration
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
[security]
force_ssl = Off
force_ssl_login = Off
allowed_hosts[] = localhost:8080
allowed_hosts[] = 127.0.0.1:8080

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; Email Configuration
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
[email]
smtp = On
smtp_server = mail
smtp_port = 25
from_address = admin@localhost
from_name = OJS Administrator

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; Performance
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
[cache]
web_cache = Off
