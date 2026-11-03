#requires -Version 7.5
[CmdletBinding()]
param([switch]$NoOpen)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot
$privateRoot=Join-Path $projectRoot '.local/newsletter-monitor'
[void](New-Item -ItemType Directory -Force -Path $privateRoot)
# The bootstrap URL is short-lived and kept in a user-only directory outside Git.
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$acl=[Security.AccessControl.DirectorySecurity]::new()
$acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false)
$rule=[Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
$acl.AddAccessRule($rule);Set-Acl -LiteralPath $privateRoot -AclObject $acl
$nodePath=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
if(-not(Test-Path -LiteralPath $nodePath)){$nodePath=(Get-Command node -ErrorAction Stop).Source}
[void](Get-Command gh -ErrorAction Stop)
$startupPath=Join-Path $privateRoot ('startup-'+[guid]::NewGuid().ToString('N')+'.json')
$scriptPath=Join-Path $PSScriptRoot 'newsletter-monitor/server.mjs'
$quotedArgs=@(('"'+$scriptPath+'"'),('"'+$startupPath+'"'))
$process=Start-Process -FilePath $nodePath -ArgumentList $quotedArgs -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru
for($i=0;$i -lt 50 -and -not(Test-Path -LiteralPath $startupPath);$i++){if($process.HasExited){throw '관리 서비스 시작에 실패했습니다.'};Start-Sleep -Milliseconds 100}
if(-not(Test-Path -LiteralPath $startupPath)){throw '관리 서비스 시작을 확인하지 못했습니다.'}
$startup=Get-Content -LiteralPath $startupPath -Raw | ConvertFrom-Json
if($startup.url -notmatch '^http://127\.0\.0\.1:\d+/open\?token=[A-Za-z0-9_-]{43}$'){throw 'Invalid local bootstrap URL'}
if($NoOpen){[pscustomobject]@{Port=$startup.port;Pid=$startup.pid;StartupFile=$startupPath};return}
Start-Process -FilePath $startup.url | Out-Null
Remove-Item -LiteralPath $startupPath
