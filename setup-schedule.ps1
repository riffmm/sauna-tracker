# Registers 11 daily Windows Task Scheduler jobs, one 5 minutes before each session.
# Run once from this folder:  powershell -ExecutionPolicy Bypass -File .\setup-schedule.ps1
# Remove later with:          Get-ScheduledTask -TaskPath '\SaunaTracker\' | Unregister-ScheduledTask -Confirm:$false
# Times are in this PC's local clock; set Windows to Eastern Time.

$dir  = $PSScriptRoot
$node = (Get-Command node).Source
$sessions = '06:00','07:30','09:00','10:30','12:00','13:30','15:00','16:30','18:00','19:30','21:00'

foreach ($s in $sessions) {
  $at = ([datetime]::ParseExact($s, 'HH:mm', $null)).AddMinutes(-5)
  $action   = New-ScheduledTaskAction -Execute 'cmd.exe' `
              -Argument "/c `"`"$node`" src\index.js check $s >> data\run.log 2>&1`"" -WorkingDirectory $dir
  $trigger  = New-ScheduledTaskTrigger -Daily -At $at
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries `
              -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
  Register-ScheduledTask -TaskPath '\SaunaTracker\' -TaskName "Session $($s.Replace(':',''))" `
    -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
  Write-Host "Scheduled $s session check at $($at.ToString('HH:mm'))"
}
