cd $PSScriptRoot
$supurl='https://yibyszcsmncrmvkalvbz.supabase.co'
$key='sb_secret_1RkeVWFsuZnUaxo7aXXCPg_eOhtHb7-'
$h=@{ 'apikey'=$key; 'Authorization'="Bearer $key"; 'Accept'='application/json' }
$u1="$supurl/rest/v1/sessions?select=*&order=started_at.desc&limit=5"
$r=Invoke-RestMethod -Uri $u1 -Headers $h -Method Get
$r | ConvertTo-Json -Depth 6
Write-Output '---SESSION_ID---'
if ($r -and $r.Count -gt 0) {
  $sid=$r[0].session_id
  Write-Output $sid
  $u2="$supurl/rest/v1/decisions?session_id=eq.$sid"
  $d=Invoke-RestMethod -Uri $u2 -Headers $h -Method Get
  Write-Output '---DECISIONS---'
  $d | ConvertTo-Json -Depth 6
  if ($d -and $d.Count -gt 0) {
    $first=$d[0].decision_id
    $u3="$supurl/rest/v1/clinical_mappings?decision_id=eq.$first"
    $cm=Invoke-RestMethod -Uri $u3 -Headers $h -Method Get
    Write-Output '---CLINICAL---'
    $cm | ConvertTo-Json -Depth 6
  }
}