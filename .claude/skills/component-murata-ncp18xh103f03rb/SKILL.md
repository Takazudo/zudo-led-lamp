---
name: component-murata-ncp18xh103f03rb
description: Resolve the exact Murata NCP18XH103F03RB NTC used on Board L. Use for nominal resistance, beta context, divider topology, ADC interpretation, self-heating, thermal response, lifecycle, and temperature-threshold questions.
---

# Murata NCP18XH103F03RB

Run the central validator and read all local JSON before using this record. The current exact Murata source was inaccessible. An older manufacturer-authored catalog from a mirror provides nominal identity context, but its lower authority cannot support `PRIMARY-SPEC PASS`; all such facts remain `UNVERIFIED`/`UNSOURCED`.

Do not convert the 3380 K beta value into a guaranteed full resistance-temperature table. The public evidence retained here does not guarantee the exact R-T curve/tolerance, installed dissipation factor, thermal time constant, current NRND status, placement response, or firmware thresholds. Those domains stay open and require exact current primary data or measurement.

Board L places RT1 from NTC_SENSE to ground, with R26 pulling up to V3P3 and C24 shunting the sense node. This establishes divider topology only. ADC code-to-temperature behavior still depends on the exact pull-up, supply/reference, sampling time, tolerances, self-heating, airflow, PCB coupling, conversion algorithm, and threshold policy.
