"""Static regression checks; runtime execution still needs the Windows runner."""
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]


class DeploymentWorkflowTests(unittest.TestCase):
    def test_execution_policy_is_applied_before_each_temporary_script_loads(self):
        workflow = (ROOT / '.github/workflows/docker-image.yml').read_text()
        shells = re.findall(r'^\s+shell: (.+)$', workflow, re.MULTILINE)
        self.assertEqual(len(shells), 2)
        for shell in shells:
            self.assertEqual(shell, 'powershell -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File {0}')
        # Setting policy inside run is too late: the temporary script is already blocked.
        self.assertNotIn('Set-ExecutionPolicy', workflow)
        self.assertEqual(workflow.count("$ErrorActionPreference = 'Stop'"), 2)

    def test_custom_shell_keeps_native_command_failure_checks(self):
        deploy = (ROOT / '.github/scripts/Deploy-Archive.ps1').read_text()
        tests = (ROOT / '.github/scripts/Test-Deploy-Archive.ps1').read_text()
        self.assertIn("$ErrorActionPreference = 'Stop'", deploy)
        self.assertIn('if ($LASTEXITCODE -ne 0)', deploy)
        self.assertIn('throw "$Program failed with exit code', deploy)
        self.assertIn("$ErrorActionPreference = 'Stop'", tests)
        self.assertIn('throw "Unexpected result for deployment test:', tests)
        for script in (deploy, tests):
            self.assertNotIn('Set-ExecutionPolicy', script)
