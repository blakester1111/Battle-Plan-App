$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut("$env:USERPROFILE\Desktop\Battle Plan.lnk")
$shortcut.TargetPath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
$shortcut.Arguments = "--app=http://localhost:4000"
$shortcut.IconLocation = "$PSScriptRoot\bp-app.ico,0"
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description = "Battle Plan App"
$shortcut.Save()
Write-Host "Desktop shortcut created: Battle Plan"
