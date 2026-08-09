# 从环境变量读取 Worker 访问令牌；未设置时使用占位符（避免硬编码真实令牌进仓库）
$workerToken = if ($env:WORKER_ACCESS_TOKEN) { $env:WORKER_ACCESS_TOKEN } else { 'REPLACE_WITH_YOUR_WORKER_ACCESS_TOKEN' }
$body = '{"question":"济南大学的地址是什么？","context":"济南大学是山东省重点大学，位于济南市。"}'
try {
    $r = Invoke-WebRequest -Uri 'https://ujn-ai-worker.draven323.workers.dev/api/chat' `
        -Method POST -Body $body -ContentType 'application/json' `
        -Headers @{'Origin' = 'https://ujn.matehub.top'; 'X-Access-Token' = $workerToken } `
        -UseBasicParsing -TimeoutSec 20
    Write-Host "HTTP $($r.StatusCode)"
    Write-Host $r.Content
}
catch {
    Write-Host "ERR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        Write-Host "Body: $($reader.ReadToEnd())"
    }
}
