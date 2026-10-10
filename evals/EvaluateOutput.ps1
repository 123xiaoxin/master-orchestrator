function Test-MasterEvalOutput {
    param([AllowEmptyString()][string]$Text, [string]$FinishReason,
          [Parameter(Mandatory)][string]$SchemaFile, $Checks = @())
    $category = 'passed'
    $codes = [System.Collections.Generic.List[string]]::new()
    if ($FinishReason -in @('length', 'max_tokens')) {
        $category = 'truncation'; $codes.Add('output_truncated')
    } elseif ([string]::IsNullOrWhiteSpace($Text)) {
        $category = 'empty_output'; $codes.Add('output_empty')
    } else {
        try { $value = ConvertFrom-Json -InputObject $Text -ErrorAction Stop }
        catch { $category = 'json_error'; $codes.Add('json_invalid') }
        if ($category -eq 'passed') {
            if (-not (Test-Json -Json $Text -SchemaFile $SchemaFile -ErrorAction SilentlyContinue)) {
                $category = 'schema_error'; $codes.Add('schema_invalid')
            }
        }
        if ($category -eq 'passed') {
            foreach ($check in @($Checks)) {
                $actual = $value
                foreach ($part in ([string]$check.path).Split('.')) {
                    if ($null -eq $actual -or $actual.PSObject.Properties.Name -notcontains $part) {
                        $actual = $null; break
                    }
                    $actual = $actual.$part
                }
                $ok = switch ($check.op) {
                    'equals' { ($actual | ConvertTo-Json -Depth 30 -Compress) -ceq ($check.value | ConvertTo-Json -Depth 30 -Compress) }
                    'in' { @($check.value) -ccontains $actual }
                    'nonEmpty' { $null -ne $actual -and @($actual).Count -gt 0 -and -not [string]::IsNullOrWhiteSpace([string]$actual) }
                    default { throw 'Unsupported behavior check operation.' }
                }
                if (-not $ok) { $category = 'behavior_error'; $codes.Add('behavior_check_failed') }
            }
        }
    }
    return [ordered]@{ok=($category -eq 'passed'); category=$category; codes=@($codes.ToArray());
        evidenceLevel='rule'; semanticJudgment='not_performed'; behaviorCheckCount=@($Checks).Count}
}
