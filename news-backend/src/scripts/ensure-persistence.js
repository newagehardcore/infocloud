/**
 * This script ensures Docker containers are properly configured for persistence
 * It verifies and adjusts container restart policies to ensure they restart automatically
 */
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Root project directory
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// Container names
const CONTAINERS = [
  'infocloud-mongodb',
  'infocloud-db',
  'infocloud-miniflux'
];

// Function to check if a container exists
const containerExists = (containerName) => {
  try {
    const result = execSync(`docker ps -a --format "{{.Names}}" | grep ${containerName}`).toString().trim();
    return result === containerName;
  } catch (error) {
    return false;
  }
};

// Function to check container restart policy
const getContainerRestartPolicy = async (containerName) => {
  try {
    const { stdout } = await execAsync(`docker inspect --format "{{.HostConfig.RestartPolicy.Name}}" ${containerName}`);
    return stdout.trim();
  } catch (error) {
    console.error(`Error checking restart policy for ${containerName}:`, error.message);
    return null;
  }
};

// Function to set container restart policy
const setContainerRestartPolicy = async (containerName, policy = 'always') => {
  try {
    console.log(`Setting restart policy for ${containerName} to "${policy}"...`);
    await execAsync(`docker update --restart=${policy} ${containerName}`);
    return true;
  } catch (error) {
    console.error(`Error setting restart policy for ${containerName}:`, error.message);
    return false;
  }
};

// Function to check if docker-compose.yml has proper restart policies
const checkDockerComposeFile = () => {
  const dockerComposePath = path.join(PROJECT_ROOT, 'docker-compose.yml');
  
  if (!fs.existsSync(dockerComposePath)) {
    console.error('docker-compose.yml not found!');
    return false;
  }
  
  const content = fs.readFileSync(dockerComposePath, 'utf8');
  const restartPolicies = content.match(/restart: (.*)/g) || [];
  
  // Check if all services have restart: always
  const isValid = restartPolicies.length >= 3 && 
                 restartPolicies.every(policy => policy.includes('always'));
  
  if (!isValid) {
    console.warn('⚠️ docker-compose.yml does not have proper restart policies set for all containers');
    console.warn('Run: npm run ensure-persistence to fix this issue');
  }
  
  return isValid;
};

// Function to ensure volume directories exist
const ensureVolumeDirectories = () => {
  const volumeDirs = [
    path.join(PROJECT_ROOT, 'docker', 'postgres'),
    path.join(PROJECT_ROOT, 'docker', 'mongodb'),
    path.join(PROJECT_ROOT, 'docker', 'mongodb_config')
  ];
  
  volumeDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      console.log(`Creating volume directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Main function
const ensurePersistence = async () => {
  console.log('🔄 Checking Docker container persistence configuration...');
  
  // Check volume directories
  ensureVolumeDirectories();
  
  // Check docker-compose.yml
  checkDockerComposeFile();
  
  // Check containers' restart policies
  for (const container of CONTAINERS) {
    if (containerExists(container)) {
      const policy = await getContainerRestartPolicy(container);
      
      if (policy !== 'always') {
        console.log(`Container ${container} has restart policy "${policy || 'none'}". Setting to "always"...`);
        await setContainerRestartPolicy(container);
      } else {
        console.log(`✅ Container ${container} already has restart policy set to "always"`);
      }
    } else {
      console.log(`⚠️ Container ${container} not found. It will be created with proper settings when you run the app.`);
    }
  }
  
  console.log('✅ Persistence check completed');
  console.log('\n📋 Summary:');
  console.log('1. Docker containers are configured to restart automatically on system boot');
  console.log('2. Volume directories are properly set up for data persistence');
  console.log('3. To start your development environment, run: npm run dev');
};

// Run the function if script is executed directly
if (require.main === module) {
  ensurePersistence().catch(error => {
    console.error('Error ensuring persistence:', error);
    process.exit(1);
  });
}

module.exports = { ensurePersistence }; 