import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma, GlobalRole, ProjectRole, Priority, SprintStatus, SpaceRole, SpaceType, StatusCategory } from '../src/client.js';

const PASSWORD = 'Test@1234';
const statusNames = ['Backlog', 'Todo', 'In Progress', 'In Review', 'Done'] as const;
const statusCategories: Record<string, StatusCategory> = {
  Backlog: StatusCategory.TODO,
  Todo: StatusCategory.TODO,
  'In Progress': StatusCategory.IN_PROGRESS,
  'In Review': StatusCategory.IN_PROGRESS,
  Done: StatusCategory.DONE
};
const statusColors: Record<string, string> = {
  Backlog: '#64748b',
  Todo: '#3b82f6',
  'In Progress': '#f59e0b',
  'In Review': '#8b5cf6',
  Done: '#22c55e'
};

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const org = await prisma.organization.upsert({
    where: { slug: 'acme-software' },
    update: { name: 'Acme Software' },
    create: { name: 'Acme Software', slug: 'acme-software', settings: { timezone: 'UTC' } }
  });

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@acme.com' },
      update: { orgId: org.id, name: 'Acme Admin', role: GlobalRole.ADMIN, passwordHash, isActive: true },
      create: { orgId: org.id, email: 'admin@acme.com', name: 'Acme Admin', passwordHash, role: GlobalRole.ADMIN }
    }),
    prisma.user.upsert({
      where: { email: 'dev1@acme.com' },
      update: { orgId: org.id, name: 'Dev One', role: GlobalRole.MEMBER, passwordHash, isActive: true },
      create: { orgId: org.id, email: 'dev1@acme.com', name: 'Dev One', passwordHash, role: GlobalRole.MEMBER }
    }),
    prisma.user.upsert({
      where: { email: 'dev2@acme.com' },
      update: { orgId: org.id, name: 'Dev Two', role: GlobalRole.MEMBER, passwordHash, isActive: true },
      create: { orgId: org.id, email: 'dev2@acme.com', name: 'Dev Two', passwordHash, role: GlobalRole.MEMBER }
    })
  ]);

  const admin = users[0];
  const projectSpecs = [
    { name: 'Platform', key: 'PM', description: 'Internal PM platform' },
    { name: 'Mobile App', key: 'MOB', description: 'Customer mobile application' }
  ];

  for (const projectSpec of projectSpecs) {
    const project = await prisma.project.upsert({
      where: { orgId_key: { orgId: org.id, key: projectSpec.key } },
      update: { name: projectSpec.name, description: projectSpec.description, leadId: admin.id },
      create: { ...projectSpec, orgId: org.id, leadId: admin.id }
    });

    for (const user of users) {
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
        update: { role: user.id === admin.id ? ProjectRole.OWNER : ProjectRole.MEMBER },
        create: { projectId: project.id, userId: user.id, role: user.id === admin.id ? ProjectRole.OWNER : ProjectRole.MEMBER }
      });
    }

    const issueTypes = [];
    for (const [index, type] of ['Bug', 'Story', 'Task'].entries()) {
      issueTypes.push(await prisma.issueType.upsert({
        where: { projectId_name: { projectId: project.id, name: type } },
        update: { color: index === 0 ? '#ef4444' : index === 1 ? '#22c55e' : '#3b82f6', position: index },
        create: { projectId: project.id, name: type, icon: type.toLowerCase(), color: index === 0 ? '#ef4444' : index === 1 ? '#22c55e' : '#3b82f6', isDefault: index === 2, position: index }
      }));
    }

    const workflow = await prisma.workflow.upsert({
      where: { projectId_name: { projectId: project.id, name: `${projectSpec.key} Default Workflow` } },
      update: { isDefault: true },
      create: { projectId: project.id, name: `${projectSpec.key} Default Workflow`, isDefault: true }
    });

    const statuses = [];
    for (const [index, name] of statusNames.entries()) {
      statuses.push(await prisma.workflowStatus.upsert({
        where: { workflowId_name: { workflowId: workflow.id, name } },
        update: { position: index, category: statusCategories[name], color: statusColors[name] },
        create: { workflowId: workflow.id, name, position: index, category: statusCategories[name], color: statusColors[name], wipLimit: name === 'In Progress' ? 4 : null }
      }));
    }

    for (let i = 0; i < statuses.length - 1; i += 1) {
      await prisma.workflowTransition.upsert({
        where: { workflowId_fromStatusId_toStatusId: { workflowId: workflow.id, fromStatusId: statuses[i].id, toStatusId: statuses[i + 1].id } },
        update: { name: `${statuses[i].name} → ${statuses[i + 1].name}` },
        create: { workflowId: workflow.id, fromStatusId: statuses[i].id, toStatusId: statuses[i + 1].id, name: `${statuses[i].name} → ${statuses[i + 1].name}` }
      });
    }

    const sprint = await prisma.sprint.upsert({
      where: { projectId_name: { projectId: project.id, name: `${projectSpec.key} Sprint 1` } },
      update: { status: SprintStatus.ACTIVE, startDate: new Date(), endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
      create: { projectId: project.id, name: `${projectSpec.key} Sprint 1`, goal: 'Seeded sprint for demo', status: SprintStatus.ACTIVE, startDate: new Date(), endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }
    });

    const label = await prisma.label.upsert({
      where: { projectId_name: { projectId: project.id, name: 'frontend' } },
      update: { color: '#06b6d4' },
      create: { projectId: project.id, name: 'frontend', color: '#06b6d4' }
    });

    const issues = [];
    for (let i = 1; i <= 10; i += 1) {
      const status = statuses[(i - 1) % statuses.length];
      const issueType = issueTypes[(i - 1) % issueTypes.length];
      const assignee = users[i % users.length];
      const issue = await prisma.issue.upsert({
        where: { key: `${projectSpec.key}-${i}` },
        update: {
          title: `${projectSpec.name} sample ${issueType.name.toLowerCase()} ${i}`,
          workflowStatusId: status.id,
          assigneeId: assignee.id,
          sprintId: i <= 8 ? sprint.id : null,
          position: i
        },
        create: {
          key: `${projectSpec.key}-${i}`,
          number: i,
          projectId: project.id,
          issueTypeId: issueType.id,
          workflowStatusId: status.id,
          title: `${projectSpec.name} sample ${issueType.name.toLowerCase()} ${i}`,
          description: `Seed issue ${i} for ${projectSpec.name}.`,
          priority: [Priority.CRITICAL, Priority.HIGH, Priority.MEDIUM, Priority.LOW][i % 4],
          reporterId: admin.id,
          assigneeId: assignee.id,
          sprintId: i <= 8 ? sprint.id : null,
          storyPoints: (i % 5) + 1,
          originalEstimate: 4 * 3600,
          remainingEstimate: 2 * 3600,
          position: i
        }
      });
      issues.push(issue);

      await prisma.issueLabel.upsert({
        where: { issueId_labelId: { issueId: issue.id, labelId: label.id } },
        update: {},
        create: { issueId: issue.id, labelId: label.id }
      });

      if (i <= 8) {
        await prisma.sprintIssue.upsert({
          where: { sprintId_issueId: { sprintId: sprint.id, issueId: issue.id } },
          update: { completedInSprint: status.name === 'Done' },
          create: { sprintId: sprint.id, issueId: issue.id, completedInSprint: status.name === 'Done' }
        });
      }
    }

    for (let i = 0; i < 5; i += 1) {
      const id = projectSpec.key === 'PM'
        ? `00000000-0000-4000-8000-0000000000${String(i + 1).padStart(2, '0')}`
        : `00000000-0000-4000-8000-0000000001${String(i + 1).padStart(2, '0')}`;
      await prisma.worklog.upsert({
        where: { id },
        update: { timeSpent: (i + 1) * 1800, dateStarted: new Date(Date.now() - i * 86400000), userId: users[(i + 1) % users.length].id, issueId: issues[i].id },
        create: { id, issueId: issues[i].id, userId: users[(i + 1) % users.length].id, timeSpent: (i + 1) * 1800, dateStarted: new Date(Date.now() - i * 86400000), description: 'Seed sample worklog' }
      });
    }

    const space = await prisma.space.upsert({
      where: { orgId_key: { orgId: org.id, key: projectSpec.key } },
      update: { name: `${projectSpec.name} Docs`, ownerId: admin.id },
      create: { orgId: org.id, type: SpaceType.PROJECT, key: projectSpec.key, name: `${projectSpec.name} Docs`, description: `Documentation for ${projectSpec.name}`, ownerId: admin.id }
    });

    for (const user of users) {
      await prisma.spaceMember.upsert({
        where: { spaceId_userId: { spaceId: space.id, userId: user.id } },
        update: { role: user.id === admin.id ? SpaceRole.OWNER : SpaceRole.EDITOR },
        create: { spaceId: space.id, userId: user.id, role: user.id === admin.id ? SpaceRole.OWNER : SpaceRole.EDITOR }
      });
    }

    await prisma.page.upsert({
      where: { spaceId_slug: { spaceId: space.id, slug: 'home' } },
      update: { title: `${projectSpec.name} Home`, updatedById: admin.id },
      create: { spaceId: space.id, title: `${projectSpec.name} Home`, slug: 'home', content: `<h1>${projectSpec.name}</h1><p>Welcome to the documentation space.</p>`, contentJson: { type: 'doc', content: [] }, createdById: admin.id, updatedById: admin.id, publishedAt: new Date() }
    });
  }

  console.log('Seed complete: Acme Software, 3 users, 2 projects, 20 issues, active sprints, worklogs, spaces.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
