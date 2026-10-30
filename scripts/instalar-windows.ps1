# Instala o SAP Estudos no Windows: pré-requisitos, build do instalador e instalação.
# Uso (PowerShell): powershell -ExecutionPolicy Bypass -File instalar-windows.ps1
# Programas nativos (git, npm) escrevem progresso no stderr; o sucesso é checado pelo código de saída.
$ErrorActionPreference = "Continue"

function Passo($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Tem($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function AtualizarPath {
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}
function Winget($id) {
  if (-not (Tem "winget")) { throw "winget não encontrado. Instale o 'App Installer' pela Microsoft Store e rode de novo." }
  winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements
  $ok = $?
  AtualizarPath
  if (-not $ok) { Write-Warning "winget retornou erro para $id; verificando se já está disponível." }
}

Passo "Verificando Git"
if (-not (Tem "git")) { Winget "Git.Git" }
git --version

Passo "Verificando Node.js"
if (-not (Tem "node")) { Winget "OpenJS.NodeJS.LTS" }
node --version

Passo "Verificando Claude Code (usado pelo chat do app)"
if (-not (Tem "claude")) {
  try { Invoke-RestMethod https://claude.ai/install.ps1 | Invoke-Expression } catch { Write-Warning "Instalação do Claude Code falhou: $_" }
  AtualizarPath
  $env:Path += ";$env:USERPROFILE\.local\bin"
}
if (Tem "claude") { claude --version } else { Write-Warning "Claude Code não ficou no PATH. O app funciona; o chat pede o caminho em Configurações." }

Passo "Baixando o código do app"
$base = Join-Path $env:TEMP "sap-estudos-build"
if (Test-Path $base) { Remove-Item $base -Recurse -Force }
New-Item -ItemType Directory $base | Out-Null
$fonte = $null
# Repositório dedicado; se ainda não existir, usa a cópia guardada no beauty-control.
git clone --depth 1 https://github.com/lguisantos/sap-estudos.git "$base\sap-estudos"
if ($LASTEXITCODE -eq 0 -and (Test-Path "$base\sap-estudos\package.json")) {
  $fonte = "$base\sap-estudos"
} else {
  git clone --depth 1 --branch claude/charming-franklin-xp5yun https://github.com/lguisantos/beauty-control.git "$base\beauty-control"
  if ($LASTEXITCODE -ne 0) { throw "Não consegui clonar o código. Confira o login do GitHub e rode de novo." }
  $fonte = "$base\beauty-control\sap-estudos"
}
Write-Host "Código em $fonte"

Passo "Gerando o instalador (alguns minutos na primeira vez)"
Push-Location $fonte
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw "npm ci falhou." }
npm run dist
if ($LASTEXITCODE -ne 0) { throw "A geração do instalador falhou." }
$exe = Get-ChildItem "$fonte\dist\*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
Pop-Location
if (-not $exe) { throw "Instalador não encontrado em dist\." }

Passo "Instalando $($exe.Name)"
Get-Process "SAP Estudos" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Process $exe.FullName -ArgumentList "/S" -Wait
$destino = Join-Path ([Environment]::GetFolderPath("Desktop")) $exe.Name
Copy-Item $exe.FullName $destino -Force
Write-Host "Cópia do instalador salva em $destino"

$app = Join-Path $env:LOCALAPPDATA "Programs\SAP Estudos\SAP Estudos.exe"
if (Test-Path $app) {
  Passo "Abrindo o SAP Estudos"
  Start-Process $app
  Write-Host "Pronto. O app fica na bandeja e busca conteúdo novo a cada 30 minutos." -ForegroundColor Green
} else {
  Write-Host "Instalado. Abra 'SAP Estudos' pelo menu Iniciar ou pelo atalho da área de trabalho." -ForegroundColor Green
}
if (-not (Tem "claude")) { Write-Host "Para o chat: abra um terminal novo e rode 'claude' uma vez para fazer login." }
