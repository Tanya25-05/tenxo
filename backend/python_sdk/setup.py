from setuptools import setup

setup(
    name='mygrid-sdk',
    version='0.1.0',
    py_modules=['mygrid'],
    entry_points={
        'console_scripts': [
            'mygrid=mygrid:main',
        ],
    },
    install_requires=[
        'requests',
        'tqdm',
        'cryptography',
    ],
    author='GPU Grid',
    description='MyGrid developer CLI',
)
