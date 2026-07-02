# UI Quality Pack 02 Test Cases

| ID | Screen | Test | Expected Result |
|---|---|---|---|
| UI02-IL-01 | Issue List | Save filter with empty name | Error message appears |
| UI02-IL-02 | Issue List | Bulk delete selected issues | Confirmation appears |
| UI02-ID-01 | Issue Detail | Create sub-task with empty title | Inline error appears, no API call |
| UI02-ID-02 | Issue Detail | Upload valid attachment | Success message and attachment appears |
| UI02-ID-03 | Issue Detail | Delete attachment | Confirmation appears |
| UI02-ID-04 | Issue Detail | Link issue with empty target | Validation message appears |
| UI02-KB-01 | Kanban | Drag into blocked transition | Card rolls back and error explains why |
| UI02-BL-01 | Backlog | Move selected issues without sprint | Error message appears |
| UI02-SP-01 | Sprints | Create sprint without name | Validation message appears |
| UI02-SP-02 | Sprints | Complete sprint | Confirmation appears |
| UI02-TM-01 | Time | Save zero-second worklog | Validation message appears |
| UI02-TM-02 | Time | Delete worklog | Confirmation appears |
| UI02-TM-03 | Timer | Start/pause/resume/stop timer | Each action gives visible feedback |
