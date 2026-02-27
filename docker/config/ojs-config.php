;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; Database Configuration
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
[database]
driver = postgres
host = db
username = ojs_user
password = your_secure_password
name = ojs_db
port = 5432

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; General Configuration
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
[general]
installed = On
; CHANGE THIS to your actual Railway domain after deploying
base_url = "https://conexus-ojs.up.railway.app" 
enable_beacon = Off
session_check_ip = Off

;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
; Security Configuration
;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
[security]
force_ssl = On
force_ssl_login = On
api_key_secret = "conexus_research_2026"