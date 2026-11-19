import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { puzzles } from '../src/puzzles.ts';

const folder = await mkdtemp(join(tmpdir(), 'zikisbomb-oracle-'));
try {
  const project = join(folder, 'Oracle.csproj');
  await writeFile(project, `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <NuGetAudit>false</NuGetAudit>
  </PropertyGroup>
</Project>
`);
  const examples = [
    ...puzzles,
    { id: 'Midpoint 1', code: 'Console.WriteLine(Math.Round(2.5));', displayAnswer: '2' },
    { id: 'Midpoint 2', code: 'Console.WriteLine(Math.Round(3.5));', displayAnswer: '4' },
  ];
  await writeFile(join(folder, 'Program.cs'), `using System;
using System.Globalization;
using System.IO;

CultureInfo.CurrentCulture = CultureInfo.InvariantCulture;

void Verify(string name, string expected, Action print)
{
    TextWriter original = Console.Out;
    using var captured = new StringWriter();
    Console.SetOut(captured);
    try { print(); }
    finally { Console.SetOut(original); }
    string actual = captured.ToString().TrimEnd();
    if (actual != expected)
        throw new InvalidOperationException($"{name} printed {actual}, expected {expected}");
    Console.WriteLine($"{name} prints {actual}");
}

${examples.map(({ id, code, displayAnswer }) =>
    `Verify("${id}", "${displayAnswer}", () => {\n    ${code.replaceAll('\n', '\n    ')}\n});`).join('\n')}
`);
  const command = spawnSync('dotnet', ['run', '--project', project], {
    env: { ...process.env, DOTNET_CLI_HOME: folder, DOTNET_NOLOGO: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1' },
    stdio: 'inherit',
  });
  if (command.error) throw command.error;
  process.exitCode = command.status ?? 1;
} finally {
  await rm(folder, { recursive: true, force: true });
}
