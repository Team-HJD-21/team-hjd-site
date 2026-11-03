#requires -Version 7.5
[CmdletBinding()]
param([switch]$NoOpen)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot
$privateRoot=Join-Path $projectRoot '.local/newsletter-monitor'
[void](New-Item -ItemType Directory -Force -Path $privateRoot)
# The bootstrap URL is short-lived and kept in a user-only directory outside Git.
$cursor=Get-Item -LiteralPath $privateRoot
while($cursor){
    if($cursor.Attributes -band [IO.FileAttributes]::ReparsePoint){throw '관리 폴더 경로에 연결된 디렉터리는 사용할 수 없습니다.'}
    $cursor=$cursor.Parent
}
if(-not ('TeamHjd.NewsletterPrivateDacl' -as [type])){
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
namespace TeamHjd {
    public static class NewsletterPrivateDacl {
        [DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
        static extern bool ConvertStringSecurityDescriptorToSecurityDescriptorW(string text, uint revision, out IntPtr descriptor, out uint size);
        [DllImport("advapi32.dll", SetLastError=true)]
        static extern bool GetSecurityDescriptorDacl(IntPtr descriptor, out bool present, out IntPtr dacl, out bool defaulted);
        [DllImport("advapi32.dll", CharSet=CharSet.Unicode)]
        static extern uint SetNamedSecurityInfoW(string name, uint kind, uint information, IntPtr owner, IntPtr group, IntPtr dacl, IntPtr sacl);
        [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr pointer);
        public static void Apply(string path, string sid) {
            IntPtr descriptor; uint size;
            if(!ConvertStringSecurityDescriptorToSecurityDescriptorW("D:P(A;OICI;FA;;;"+sid+")",1,out descriptor,out size))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            try {
                bool present, defaulted; IntPtr dacl;
                if(!GetSecurityDescriptorDacl(descriptor,out present,out dacl,out defaulted)||!present)
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                uint result=SetNamedSecurityInfoW(path,1,0x80000004,IntPtr.Zero,IntPtr.Zero,dacl,IntPtr.Zero);
                if(result!=0)throw new Win32Exception((int)result);
            } finally {LocalFree(descriptor);}
        }
    }
}
'@
}
# Apply only this directory's DACL; never change owner, SACL or system privileges.
[TeamHjd.NewsletterPrivateDacl]::Apply($privateRoot,[Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
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
